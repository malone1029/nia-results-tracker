# Growth-Focused Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shift the Hub from compliance-checkbox accountability to a growth-oriented experience — replacing rigid rules with genuine progress signals, expanding the member sidebar to include all relevant pages, personalizing the Home page for SLT process owners, and updating the scorecard and onboarding to match.

**Architecture:** Five focused changes across compliance logic, nav, dashboard, scorecard UI, and onboarding content. No new tables or API routes needed. The compliance engine (`lib/compliance.ts`) is a pure function — update it and its callers separately. The dashboard is a client component that already fetches all the data we need; we add role-awareness and a comparison stat card. The sidebar uses a `memberNavGroups` constant — we expand it.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase client-side queries, Tailwind CSS v4 (semantic color tokens only — never hardcoded hex)

---

## Codebase Context (read before implementing any task)

### Key files

- `lib/compliance.ts` — pure compliance engine, takes pre-fetched data, returns pass/fail
- `app/api/owner/[id]/route.ts` — fetches data and calls `computeCompliance()`, returns scorecard JSON
- `app/owner/[id]/page.tsx` — renders the scorecard UI from the API response
- `app/onboarding/page.tsx` — 4-chapter onboarding wizard, content is a `CHAPTERS` constant
- `app/page.tsx` — Dashboard (to be renamed "Home"), client component, fetches all data itself
- `components/dashboard/stat-cards.tsx` — `StatCardsRow` component with 5 stat cards
- `components/sidebar.tsx` — `memberNavGroups` constant controls what members see

### Role system

- `super_admin` → sees everything
- `admin` → sees `navGroups` + `adminNavGroups`
- `member` → sees only `memberNavGroups` (currently very sparse)
- Role is stored in `user_roles.role` and surfaced via `useRole()` hook

### Compliance model (current → new)

| Old check                | New check                                  |
| ------------------------ | ------------------------------------------ |
| onboardingComplete       | onboardingComplete (keep)                  |
| metricsAllCurrent        | metricsAllCurrent (keep)                   |
| processRecentlyUpdated   | healthScoreGrowing (new)                   |
| taskCompletedThisQuarter | adliImproving (new)                        |
| processStatusAcceptable  | (removed — folded into healthScoreGrowing) |

### `process_adli_scores` table columns

`process_id`, `overall_score`, `approach_score`, `deployment_score`, `learning_score`, `integration_score`, `scored_at`

### Dashboard stat cards (current)

1. My Readiness (health ring, avg health score)
2. Baldrige Ready (count of processes ≥ 80)
3. Needs Attention (count of processes < 40 or stale)
4. Overdue (metrics + tasks)
5. Active Tasks

---

## Task 1: Compliance Logic Redesign

**Files:**

- Modify: `lib/compliance.ts`
- Modify: `app/api/owner/[id]/route.ts`

### What changes

Replace the 5-check model with 4 checks. Remove `processRecentlyUpdated`, `taskCompletedThisQuarter`, `processStatusAcceptable`. Add `healthScoreGrowing` and `adliImproving`.

**New thresholds (at top of compliance.ts):**

```typescript
const HEALTH_SCORE_HEALTHY_THRESHOLD = 60; // "On Track" level — passes healthScoreGrowing
const ADLI_MATURE_THRESHOLD = 4; // all dims ≥ 4 → considered mature, passes adliImproving
const ADLI_LOOKBACK_DAYS = 90; // compare ADLI over rolling 90-day window
```

**New `ComplianceInput` shape:**

```typescript
export interface AdliScorePoint {
  score: number;
  scoredAt: string;
}

export interface ComplianceInput {
  onboardingCompletedAt: string | null;
  avgHealthScore: number | null; // avg health across owned processes (0–100), passed from caller
  processes: {
    metrics: MetricComplianceInput[];
    adliHistory: AdliScorePoint[]; // all ADLI scores for this process, newest first
    adliDimensions: {
      // latest ADLI dimension scores (null if never scored)
      approach: number;
      deployment: number;
      learning: number;
      integration: number;
    } | null;
  }[];
}
```

**New `ComplianceChecks` shape:**

```typescript
export interface ComplianceChecks {
  onboardingComplete: boolean;
  metricsAllCurrent: boolean;
  healthScoreGrowing: boolean;
  adliImproving: boolean;
}
```

**New `computeCompliance()` logic:**

```typescript
export function computeCompliance(input: ComplianceInput): ComplianceResult {
  const now = new Date();

  // Check 1: Onboarding (unchanged)
  const onboardingComplete = !!input.onboardingCompletedAt;

  // Check 2: Metrics current (unchanged — keep CADENCE_GRACE logic)
  const allMetrics = input.processes.flatMap((p) => p.metrics);
  const metricsAllCurrent =
    allMetrics.length === 0 ||
    allMetrics.every((m) => {
      if (m.nextEntryExpected) {
        const nextDate = new Date(m.nextEntryExpected + 'T00:00:00');
        if (nextDate > now) return true;
      }
      if (!m.lastEntryDate) return false;
      const grace = CADENCE_GRACE[m.cadence] ?? 438;
      return daysBetween(m.lastEntryDate, now) <= grace;
    });

  // Check 3: Health score at or above healthy threshold
  // Passes if average health score across owned processes is ≥ 60.
  // Owners with no processes pass (nothing to score yet).
  const healthScoreGrowing =
    input.processes.length === 0 ||
    (input.avgHealthScore !== null && input.avgHealthScore >= HEALTH_SCORE_HEALTHY_THRESHOLD);

  // Check 4: ADLI improving over time
  // Passes if ANY owned process meets one of:
  //   a) All 4 ADLI dimensions ≥ ADLI_MATURE_THRESHOLD (4) — already mature
  //   b) Latest ADLI score > a score from ≥90 days ago — actively improving
  //   c) Has a recent ADLI score (within 90 days) but no older comparison yet — first-time scorer grace
  // Fails if no processes have any ADLI scores at all (owner hasn't engaged with AI coach).
  const hasAnyAdliScore = input.processes.some((p) => p.adliHistory.length > 0);
  const adliImproving =
    input.processes.length === 0 ||
    (!hasAnyAdliScore
      ? false
      : input.processes.some((p) => {
          // (a) Mature: all dims at threshold
          if (p.adliDimensions) {
            const { approach, deployment, learning, integration } = p.adliDimensions;
            if (
              approach >= ADLI_MATURE_THRESHOLD &&
              deployment >= ADLI_MATURE_THRESHOLD &&
              learning >= ADLI_MATURE_THRESHOLD &&
              integration >= ADLI_MATURE_THRESHOLD
            )
              return true;
          }
          // Get latest score
          const latest = p.adliHistory[0];
          if (!latest) return false;
          // (b) Improvement over older score
          const olderScore = p.adliHistory.find(
            (s) => daysBetween(s.scoredAt, now) >= ADLI_LOOKBACK_DAYS
          );
          if (olderScore) return latest.score > olderScore.score;
          // (c) Recent first-time scorer grace (no older score to compare)
          return daysBetween(latest.scoredAt, now) <= ADLI_LOOKBACK_DAYS;
        }));

  const checks: ComplianceChecks = {
    onboardingComplete,
    metricsAllCurrent,
    healthScoreGrowing,
    adliImproving,
  };
  const isCompliant = Object.values(checks).every(Boolean);
  return { isCompliant, checks };
}
```

Remove the old constants `PROCESS_UPDATE_WINDOW_DAYS`, `TASK_COMPLETION_WINDOW_DAYS`, `MIN_ACCEPTABLE_STATUS`.

### Updates to `app/api/owner/[id]/route.ts`

**Step 1:** Update the ADLI scores query to include dimension scores:

```typescript
const { data: adliScores } =
  processIds.length > 0
    ? await supabase
        .from('process_adli_scores')
        .select(
          'process_id, overall_score, approach_score, deployment_score, learning_score, integration_score, scored_at'
        )
        .in('process_id', processIds)
        .order('scored_at', { ascending: false })
    : { data: [] };
```

**Step 2:** Build per-process ADLI history map (all scores, not just latest):

```typescript
// Group all ADLI scores by process (already ordered newest-first)
const adliHistoryByProcess = new Map<number, { score: number; scoredAt: string }[]>();
const adliDimensionsByProcess = new Map<
  number,
  { approach: number; deployment: number; learning: number; integration: number }
>();

for (const s of adliScores ?? []) {
  if (!adliHistoryByProcess.has(s.process_id)) {
    adliHistoryByProcess.set(s.process_id, []);
    // First entry = latest = dimensions for compliance
    adliDimensionsByProcess.set(s.process_id, {
      approach: s.approach_score ?? 0,
      deployment: s.deployment_score ?? 0,
      learning: s.learning_score ?? 0,
      integration: s.integration_score ?? 0,
    });
  }
  adliHistoryByProcess.get(s.process_id)!.push({
    score: s.overall_score,
    scoredAt: s.scored_at,
  });
}
```

**Step 3:** Compute avgHealthScore using a simple formula from what the API already has.
Use ADLI overall score as a direct proxy (scale 1–5 mapped to 20–100):

```typescript
// avgHealthScore: map ADLI (1-5) to a 0-100 proxy.
// Formula: ((adli - 1) / 4) * 80 + 20  →  adli=1→20, adli=3→60, adli=5→100
// Average across all processes that have ADLI scores.
const processesWithAdli = processIds.filter((id) => latestAdliByProcess.has(id));
const avgHealthScore =
  processesWithAdli.length > 0
    ? Math.round(
        processesWithAdli.reduce((sum, id) => {
          const adli = latestAdliByProcess.get(id) ?? 1;
          return sum + ((adli - 1) / 4) * 80 + 20;
        }, 0) / processesWithAdli.length
      )
    : null;
```

**Step 4:** Update `processesForCompliance` build to use new shape:

```typescript
const processesForCompliance = (processes ?? []).map((p) => ({
  metrics: /* same as before */,
  adliHistory: adliHistoryByProcess.get(p.id) ?? [],
  adliDimensions: adliDimensionsByProcess.get(p.id) ?? null,
}));
```

**Step 5:** Update `computeCompliance` call:

```typescript
const compliance = computeCompliance({
  onboardingCompletedAt: owner.onboarding_completed_at,
  avgHealthScore,
  processes: processesForCompliance,
});
```

**Step 6:** Remove the old `completedTasks` fetch (no longer needed for compliance):

```typescript
// DELETE this entire block — taskCompletedThisQuarter check is gone:
// const { data: completedTasks } = processIds.length > 0 ? ...
```

Note: `completedTasks` was used for compliance only. The `growth.taskCompletionRate` is still computed from `allTasks` — keep that fetch.

### Commit

```bash
git add lib/compliance.ts app/api/owner/\[id\]/route.ts
git commit -m "redesign compliance checks: growth signals replace rigid rules"
```

---

## Task 2: Onboarding Chapter 3 Rewrite

**Files:**

- Modify: `app/onboarding/page.tsx` (Chapter 3 content only — `CHAPTERS[2]`)

### What to replace

Find the chapter with `id: "expectations"`. Replace all 4 content blocks:

```typescript
{
  id: "expectations",
  title: "How We Know You're Growing",
  subtitle: "Chapter 3 of 4",
  content: [
    {
      heading: "Growth, Not Compliance",
      body: "NIA doesn't measure success by whether you followed a checklist. We measure it by whether your processes are getting better over time. The Hub tracks three signals that tell that story honestly.",
    },
    {
      heading: "Signal 1: Your Metrics Are Current",
      body: "Data that's never entered can't tell you anything. Keeping your linked metrics logged within their cadence window is the foundation — it means your processes are actually being watched, not just documented.",
    },
    {
      heading: "Signal 2: Your Health Score Is Healthy",
      body: "The Hub calculates a health score for each of your processes based on the quality and depth of your documentation and ADLI maturity. A score of 60 or above means you're on track. You don't need a perfect score — you need to be in the game.",
    },
    {
      heading: "Signal 3: Your ADLI Maturity Is Improving",
      body: "ADLI scores measure how systematically your approach, deployment, learning, and integration are working. Use the AI coach to score your ADLI and identify what to improve next. Rising scores over time — or reaching maturity on all four dimensions — is the signal we're looking for.",
    },
  ],
},
```

### Commit

```bash
git add app/onboarding/page.tsx
git commit -m "rewrite onboarding Chapter 3 to explain growth signals"
```

---

## Task 3: Scorecard Compliance Panel Update

**Files:**

- Modify: `app/owner/[id]/page.tsx`

### What changes

1. Rename the compliance panel heading from "Activity Compliance" to "Growth Signals"
2. Update `checkItems` array to match new check names and provide growth-oriented labels/details
3. Update the `ScorecardData` interface to reflect new check names

**Step 1:** Update the `ScorecardData` interface:

```typescript
// In the ComplianceChecks shape within ScorecardData:
compliance: {
  isCompliant: boolean;
  checks: {
    onboardingComplete: boolean;
    metricsAllCurrent: boolean;
    healthScoreGrowing: boolean;
    adliImproving: boolean;
  }
}
```

**Step 2:** Update `checkItems` array (currently at line ~162):

```typescript
const checkItems = [
  {
    label: 'Onboarding complete',
    passing: checks.onboardingComplete,
    detail: checks.onboardingComplete
      ? "You've completed the orientation program"
      : 'Complete the onboarding program to get started',
  },
  {
    label: 'Metrics current',
    passing: checks.metricsAllCurrent,
    detail: checks.metricsAllCurrent
      ? 'All linked metrics logged within their cadence window'
      : 'One or more metrics are overdue — visit Data Health to review',
  },
  {
    label: 'Health score on track',
    passing: checks.healthScoreGrowing,
    detail: checks.healthScoreGrowing
      ? 'Your process health score is at or above the On Track threshold (60)'
      : 'Health score is below 60 — focus on documentation and ADLI depth to improve it',
  },
  {
    label: 'ADLI maturity improving',
    passing: checks.adliImproving,
    detail: checks.adliImproving
      ? 'Your ADLI scores are improving or have reached maturity'
      : 'Ask the AI coach to score your ADLI maturity — rising scores here are the key growth signal',
  },
];
```

**Step 3:** Update the panel heading:

```tsx
// Change "Activity Compliance" to "Growth Signals"
<h2 className="text-lg font-semibold text-foreground mb-1">Growth Signals</h2>
<p className="text-xs text-text-muted mb-4">All signals should be green for full compliance</p>
```

**Step 4:** The overall compliance badge ("✓ Compliant" / "⚠ Not Compliant") stays as-is. No change needed.

### Commit

```bash
git add app/owner/\[id\]/page.tsx
git commit -m "update scorecard compliance panel to show growth signals"
```

---

## Task 4: Dashboard — Home Rename + Role-Based Stat Cards

**Files:**

- Modify: `app/page.tsx`
- Modify: `components/dashboard/stat-cards.tsx`

### What changes

**A) Fetch user role in the dashboard**

In the `fetchAll()` function inside `app/page.tsx`, add a role fetch to the existing `Promise.all()`. Add state:

```typescript
const [userRole, setUserRole] = useState<string>('member');
```

Inside `fetchAll()`, add to the Promise.all array:

```typescript
supabase
  .from('user_roles')
  .select('role')
  .eq('auth_id', uid || '')
  .single();
```

Then after the Promise.all resolves:

```typescript
const roleData = /* the new result */;
const role = roleData?.data?.role ?? "member";
setUserRole(role);
```

Note: `uid` is set from `userRes.data?.user?.id`. Fetch role after getting `uid`.

Actually — the `uid` isn't available until after `userRes` resolves. Restructure: get uid first from userRes, then fetch role as part of the same Promise.all since all queries run in parallel and uid isn't needed for the role query — we query by the auth session which Supabase handles automatically. Use:

```typescript
supabase.from('user_roles').select('role').single();
// Supabase RLS + auth session means this returns the current user's role
```

**B) Compute orgAvgHealth and myAvgHealth**

The dashboard already fetches all processes and health scores. After computing `avgHealth` (which is filtered by selectedOwner when one is selected), also compute the org-wide average:

```typescript
// Org-wide average (all processes, regardless of filter)
let orgAvgHealth = 0;
let orgHealthCount = 0;
for (const proc of processes) {
  const h = healthScores.get(proc.id);
  if (h) {
    orgAvgHealth += h.total;
    orgHealthCount++;
  }
}
orgAvgHealth = orgHealthCount > 0 ? Math.round(orgAvgHealth / orgHealthCount) : 0;
```

**C) Replace "Baldrige Ready" stat card for members**

In `components/dashboard/stat-cards.tsx`, update `StatCardsRow` to accept an optional `orgAvgHealth` prop and a `isMember` flag:

```typescript
export default function StatCardsRow({
  // ... existing props ...
  orgAvgHealth,
  isMember,
}: {
  // ... existing prop types ...
  orgAvgHealth?: number;
  isMember?: boolean;
}) {
```

Replace the "Baldrige Ready" card with a conditional:

```tsx
{
  isMember ? (
    <StatCard
      label="NIA Average"
      value={orgAvgHealth !== undefined ? orgAvgHealth : '--'}
      color={
        orgAvgHealth !== undefined
          ? avgHealth >= orgAvgHealth
            ? '#b1bd37'
            : '#f79935'
          : 'var(--text-muted)'
      }
      subtitle={
        orgAvgHealth !== undefined && avgHealth > 0
          ? avgHealth >= orgAvgHealth
            ? "You're above average"
            : 'Below NIA average'
          : undefined
      }
      helpText="NIA's average process health score across all process owners."
    />
  ) : (
    <StatCard
      label="Baldrige Ready"
      value={baldrigeReadyCount}
      color={baldrigeReadyCount > 0 ? '#b1bd37' : 'var(--text-muted)'}
      subtitle={processCount > 0 ? `of ${processCount} processes` : undefined}
      href="/readiness"
      helpText="Processes scoring 80+ on health assessment."
    />
  );
}
```

**D) Rename page title for members**

In `app/page.tsx`, change the page heading logic:

```tsx
<h1 className="text-3xl font-bold text-nia-dark">
  {firstName ? `Welcome back, ${firstName}` : "Home"}
</h1>
<p className="text-text-tertiary mt-1">
  {isAdmin
    ? (!isAll && userName ? `${userName}'s processes` : "Organization-wide overview")
    : `${userName || "Your"} processes`
  }
</p>
```

Also update `document.title`:

```typescript
document.title = 'Home | NIA Excellence Hub';
```

**E) Hide owner filter for members**

Wrap the owner filter dropdown in a role check:

```tsx
{
  isAdmin && (
    <div className="flex items-center gap-2 bg-surface-subtle rounded-xl p-2">
      {/* ... existing type filter + owner dropdown ... */}
    </div>
  );
}
```

For members, auto-select their name on load and don't show the dropdown. The auto-select logic already exists — just remove the UI when `!isAdmin`.

**F) Pass new props from page to StatCardsRow**

```tsx
<StatCardsRow
  // ... existing props ...
  orgAvgHealth={orgAvgHealth}
  isMember={!isAdmin}
/>
```

Where `isAdmin` is derived from `userRole`:

```typescript
const isAdmin = userRole === 'admin' || userRole === 'super_admin';
```

**G) Rename "Baldrige Ready" health level label**

Currently at line ~289:

```typescript
avgHealth >= 80 ? { label: "Baldrige Ready", color: "#b1bd37" }
```

Change to:

```typescript
avgHealth >= 80 ? { label: "Excellence Ready", color: "#b1bd37" }
```

This removes award language from the health score label for everyone.

Also update the `ReadinessCard` help text:

```typescript
<HelpTip text="Weighted average of all process health scores. Key processes count 2x." />
```

(No change needed — already neutral.)

And update the wins text in the recent wins array (line ~363):

```typescript
// Change "is Baldrige Ready" to "is Excellence Ready"
recentWins.push({
  emoji: '🏆',
  text: `${name} is Excellence Ready`,
  health: h.total,
  color: h.level.color,
});
```

### Commit

```bash
git add app/page.tsx components/dashboard/stat-cards.tsx
git commit -m "rename Dashboard to Home, add role-aware stat cards with NIA comparison"
```

---

## Task 5: Sidebar Member Nav Expansion + Classifications to Admin

**Files:**

- Modify: `components/sidebar.tsx`

### What changes

**A) Expand `memberNavGroups`** to include all pages Jon confirmed should be member-visible:

```typescript
const memberNavGroups = [
  {
    label: 'My Hub',
    links: [
      { href: '/', label: 'Home', icon: 'grid' },
      { href: '/my-tasks', label: 'My Tasks', icon: 'check-circle' },
      { href: '/my-scorecard', label: 'My Scorecard', icon: 'award' },
      { href: '/data-health', label: 'Data Health', icon: 'heart' },
      { href: '/log', label: 'Log Data', icon: 'edit' },
    ],
  },
  {
    label: 'Processes',
    links: [{ href: '/processes', label: 'Processes', icon: 'folder' }],
  },
  {
    label: 'Results',
    links: [
      { href: '/readiness', label: 'Readiness', icon: 'shield-check' },
      { href: '/adli-insights', label: 'ADLI Insights', icon: 'radar' },
      { href: '/letci', label: 'LeTCI', icon: 'bar-chart' },
      { href: '/schedule', label: 'Schedule', icon: 'calendar' },
    ],
  },
];
```

**B) Move Classifications and Categories to admin nav**

Add to the beginning of `adminNavGroups[0].links`:

```typescript
{ href: "/classifications", label: "Classifications", icon: "tag" },
{ href: "/categories", label: "Categories", icon: "layers" },
```

Remove them from `memberNavGroups` (already done above — they don't appear there).

Also remove them from the main `navGroups` Processes group (admin users see `navGroups`, not `memberNavGroups`):

```typescript
// In navGroups, Processes group — remove /classifications and /categories:
{
  label: "Processes",
  links: [
    { href: "/processes", label: "Processes", icon: "folder" },
    // classifications and categories moved to adminNavGroups
  ],
},
```

**C) Rename "Dashboard" to "Home" in `navGroups`** (admin view):

```typescript
{ href: "/", label: "Home", icon: "grid" },
```

**D) Also rename in the sidebar subtitle** at line ~378:

```tsx
// Change "Baldrige Framework" to "Excellence Framework"
<div className="text-white/50 text-[11px]">Excellence Framework</div>
```

### Commit

```bash
git add components/sidebar.tsx
git commit -m "expand member sidebar nav; move classifications to admin; rename Dashboard to Home"
```

---

## Verification

After all 5 tasks are committed and the branch is merged:

1. **Compliance:** Visit `/owner/[your-id]` — scorecard shows 4 checks: "Onboarding complete", "Metrics current", "Health score on track", "ADLI maturity improving". No mention of 90-day update rule or task completion.

2. **Onboarding:** Visit `/onboarding` → Chapter 3 titled "How We Know You're Growing" with 4 growth-signal blocks.

3. **Scorecard panel:** Heading reads "Growth Signals". Check labels match new names.

4. **Home page (admin):** Visit `/` as admin — page shows "Home" in header, org-wide stat cards including "Baldrige Ready" count. Owner filter visible.

5. **Home page (member):** Visit `/` as member — page shows "Welcome back, [Name]", personal stat cards, "NIA Average" comparison card instead of "Baldrige Ready". No owner filter dropdown.

6. **Sidebar (member):** Shows "My Hub" group (Home, My Tasks, My Scorecard, Data Health, Log Data), "Processes" group (Processes only), "Results" group (Readiness, ADLI Insights, LeTCI, Schedule). No Classifications or Categories.

7. **Sidebar (admin):** Admin group includes Classifications and Categories. Analytics group has all analytics pages.

8. **"Excellence Ready"** appears at 80+ health score instead of "Baldrige Ready" throughout the dashboard.
