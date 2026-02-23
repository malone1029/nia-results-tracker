# Process Owner Onboarding & Scorecard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a three-page system — onboarding program, personal scorecard, and admin overview — that orients process owners to the Hub and tracks their compliance and growth.

**Architecture:** A pure `lib/compliance.ts` engine computes compliance checks from existing Hub data (no new data collection). A single scorecard page at `app/owner/[id]/page.tsx` serves both process owners (their own) and admins (anyone's). Onboarding completion is stored in `user_roles.onboarding_completed_at` so it persists across devices and is queryable server-side for compliance checks.

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS v4, existing `lib/review-status.ts` cadence logic, existing `lib/process-health.ts` health scoring, existing `useRole()` hook.

**Design doc:** `docs/plans/2026-02-22-process-owner-onboarding-design.md`

---

## Codebase Orientation

**Key files to understand before starting:**
- `lib/review-status.ts` — `getReviewStatus(cadence, lastEntryDate)` and `CADENCE_DAYS` constants — reuse these for compliance metric check
- `lib/process-health.ts` — `computeHealth()` function and `HealthResult` interface — use to compute health scores for display
- `lib/auth-helpers.ts` — `AppRole`, `isAdminRole()` — use for role checks in API routes
- `lib/use-role.ts` — `useRole()` hook — use in page components
- `lib/supabase-server.ts` — `createSupabaseServer()` — use in every API route
- `components/sidebar.tsx` — `navGroups`, `adminNavGroups` — add links here in Task 7
- `components/ui/` — `Card`, `Button`, `Badge` — use for all UI components
- `app/api/auth/role/route.ts` — pattern for auth checking in API routes

**Owner matching:** Processes link to owners via `processes.owner` (text field) matched against `user_roles.full_name`. This is a soft link — exact string match. Keep this in mind when querying.

**Compliance principle:** "I'll accept progress. I won't accept a failure to use."
- Activity compliance = binary (green/red, no amber)
- Growth trajectory = directional (sparkline, trend arrows)

---

## Task 1: Database Migration — Add Onboarding Tracking

**Files:**
- Create: `supabase/migrations/20260222050000_onboarding-tracking.sql`

**Step 1: Write the migration**

```sql
-- Add onboarding completion tracking to user_roles
-- Null = not completed. Timestamp = when they finished.

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

**Step 2: Push the migration**

```bash
cd /Users/jonmalone/projects/nia-results-tracker
supabase db push
```

Expected output: `Finished supabase db push.`

**Step 3: Commit**

```bash
git add supabase/migrations/20260222050000_onboarding-tracking.sql
git commit -m "feat: add onboarding_completed_at to user_roles"
```

---

## Task 2: Compliance Engine

**Files:**
- Create: `lib/compliance.ts`

This is a pure function — no DB calls, no side effects. Takes data already fetched and returns compliance status. Tests verify it in isolation.

**Step 1: Write the compliance engine**

```typescript
// lib/compliance.ts
// Pure compliance engine — takes pre-fetched data, returns pass/fail per check.
// "I'll accept progress. I won't accept a failure to use." — Jon Malone
//
// Compliance thresholds (adjust here if expectations change):
const PROCESS_UPDATE_WINDOW_DAYS = 90;     // must update process docs within 90 days
const TASK_COMPLETION_WINDOW_DAYS = 90;    // must complete at least 1 task per 90 days
const MIN_ACCEPTABLE_STATUS = ["ready_for_review", "approved"]; // at least one process must be here

// Metric cadence windows match lib/review-status.ts CADENCE_DAYS
// monthly=30, quarterly=90, semi-annual=182, annual=365
// We add a 20% grace buffer to avoid penalizing near-due metrics
const CADENCE_GRACE: Record<string, number> = {
  monthly: 36,
  quarterly: 108,
  "semi-annual": 218,
  annual: 438,
};

export interface MetricComplianceInput {
  cadence: string;
  lastEntryDate: string | null;
}

export interface ComplianceInput {
  onboardingCompletedAt: string | null;
  processes: {
    updated_at: string;
    status: string;
    metrics: MetricComplianceInput[];
    tasksCompletedDates: string[]; // completed_at values for tasks completed in system
  }[];
}

export interface ComplianceChecks {
  onboardingComplete: boolean;     // has completed onboarding program
  metricsAllCurrent: boolean;      // all linked metrics within cadence window (with grace)
  processRecentlyUpdated: boolean; // at least one process updated within 90 days
  taskCompletedThisQuarter: boolean; // at least one task completed in rolling 90 days
  processStatusAcceptable: boolean;  // at least one process at ready_for_review or approved
}

export interface ComplianceResult {
  isCompliant: boolean;
  checks: ComplianceChecks;
}

function daysBetween(dateStr: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCompliance(input: ComplianceInput): ComplianceResult {
  const now = new Date();

  // Check 1: Onboarding
  const onboardingComplete = !!input.onboardingCompletedAt;

  // Check 2: Metrics all current (cadence-aware with grace buffer)
  // A user with no processes or no metrics passes this check
  const allMetrics = input.processes.flatMap((p) => p.metrics);
  const metricsAllCurrent =
    allMetrics.length === 0 ||
    allMetrics.every((m) => {
      if (!m.lastEntryDate) return false; // no data = not current
      const grace = CADENCE_GRACE[m.cadence] ?? 438;
      return daysBetween(m.lastEntryDate, now) <= grace;
    });

  // Check 3: At least one process updated within 90 days
  const processRecentlyUpdated =
    input.processes.length === 0
      ? false
      : input.processes.some(
          (p) => daysBetween(p.updated_at, now) <= PROCESS_UPDATE_WINDOW_DAYS
        );

  // Check 4: At least one task completed in rolling 90 days
  const allCompletedDates = input.processes.flatMap((p) => p.tasksCompletedDates);
  const taskCompletedThisQuarter = allCompletedDates.some(
    (d) => daysBetween(d, now) <= TASK_COMPLETION_WINDOW_DAYS
  );

  // Check 5: At least one process at acceptable status
  const processStatusAcceptable =
    input.processes.length === 0
      ? false
      : input.processes.some((p) => MIN_ACCEPTABLE_STATUS.includes(p.status));

  const checks: ComplianceChecks = {
    onboardingComplete,
    metricsAllCurrent,
    processRecentlyUpdated,
    taskCompletedThisQuarter,
    processStatusAcceptable,
  };

  const isCompliant = Object.values(checks).every(Boolean);

  return { isCompliant, checks };
}
```

**Step 2: Verify it runs without errors**

```bash
cd /Users/jonmalone/projects/nia-results-tracker
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add lib/compliance.ts
git commit -m "feat: add compliance engine for process owner scorecard"
```

---

## Task 3: Scorecard API Route

**Files:**
- Create: `app/api/owner/[id]/route.ts`

This route serves two purposes: GET returns scorecard data, POST with `action=complete-onboarding` marks onboarding done.

**Step 1: Write the API route**

```typescript
// app/api/owner/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole } from "@/lib/auth-helpers";
import { computeCompliance } from "@/lib/compliance";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetAuthId } = await params;
  const supabase = await createSupabaseServer();

  // Auth: get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role check: members can only view their own scorecard
  const { data: myRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const role = myRole?.role ?? "member";
  if (!isAdminRole(role) && user.id !== targetAuthId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch target user
  const { data: owner, error: ownerErr } = await supabase
    .from("user_roles")
    .select("auth_id, email, full_name, role, last_login_at, onboarding_completed_at")
    .eq("auth_id", targetAuthId)
    .single();

  if (ownerErr || !owner) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch processes owned by this user (match on full_name)
  const ownerName = owner.full_name ?? owner.email;
  const { data: processes } = await supabase
    .from("processes")
    .select(`
      id, name, status, updated_at, process_type,
      adli_approach, adli_deployment, adli_learning, adli_integration,
      charter, workflow
    `)
    .eq("owner", ownerName);

  const processIds = (processes ?? []).map((p) => p.id);

  // Fetch metrics for these processes (via metric_processes junction)
  const { data: metricLinks } = processIds.length > 0
    ? await supabase
        .from("metric_processes")
        .select("process_id, metrics(id, name, cadence)")
        .in("process_id", processIds)
    : { data: [] };

  // Fetch latest entry date per metric
  const metricIds = (metricLinks ?? [])
    .flatMap((ml) => (ml.metrics ? [ml.metrics] : []))
    .map((m: { id: number }) => m.id);

  const { data: latestEntries } = metricIds.length > 0
    ? await supabase
        .from("entries")
        .select("metric_id, date")
        .in("metric_id", metricIds)
        .order("date", { ascending: false })
    : { data: [] };

  // Build a map: metric_id -> latest date
  const latestByMetric = new Map<number, string>();
  for (const e of latestEntries ?? []) {
    if (!latestByMetric.has(e.metric_id)) {
      latestByMetric.set(e.metric_id, e.date);
    }
  }

  // Fetch completed tasks for these processes in rolling 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: completedTasks } = processIds.length > 0
    ? await supabase
        .from("process_tasks")
        .select("process_id, completed_at")
        .in("process_id", processIds)
        .eq("completed", true)
        .gte("completed_at", ninetyDaysAgo.toISOString())
    : { data: [] };

  // Fetch ADLI scores per process
  const { data: adliScores } = processIds.length > 0
    ? await supabase
        .from("process_adli_scores")
        .select("process_id, overall_score, scored_at")
        .in("process_id", processIds)
        .order("scored_at", { ascending: false })
    : { data: [] };

  // Latest ADLI score per process
  const latestAdliByProcess = new Map<number, number>();
  for (const s of adliScores ?? []) {
    if (!latestAdliByProcess.has(s.process_id)) {
      latestAdliByProcess.set(s.process_id, s.overall_score);
    }
  }

  // Fetch improvement journal count this calendar year
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const { count: improvementCount } = processIds.length > 0
    ? await supabase
        .from("process_improvements")
        .select("*", { count: "exact", head: true })
        .in("process_id", processIds)
        .gte("committed_date", yearStart)
    : { count: 0 };

  // Build compliance input
  const processesForCompliance = (processes ?? []).map((p) => {
    const pMetrics = (metricLinks ?? [])
      .filter((ml) => ml.process_id === p.id)
      .flatMap((ml) => (ml.metrics ? [ml.metrics as { id: number; name: string; cadence: string }] : []));

    return {
      updated_at: p.updated_at,
      status: p.status,
      metrics: pMetrics.map((m) => ({
        cadence: m.cadence,
        lastEntryDate: latestByMetric.get(m.id) ?? null,
      })),
      tasksCompletedDates: (completedTasks ?? [])
        .filter((t) => t.process_id === p.id && t.completed_at)
        .map((t) => t.completed_at as string),
    };
  });

  const compliance = computeCompliance({
    onboardingCompletedAt: owner.onboarding_completed_at,
    processes: processesForCompliance,
  });

  // Task completion rate this quarter (all tasks, not just recent completions)
  const { data: allTasks } = processIds.length > 0
    ? await supabase
        .from("process_tasks")
        .select("completed")
        .in("process_id", processIds)
        .in("origin", ["hub_manual", "asana"])
    : { data: [] };

  const totalTasks = (allTasks ?? []).length;
  const completedTasksTotal = (allTasks ?? []).filter((t) => t.completed).length;
  const taskCompletionRate = totalTasks > 0
    ? Math.round((completedTasksTotal / totalTasks) * 100)
    : null;

  return NextResponse.json({
    owner,
    processes: (processes ?? []).map((p) => ({
      ...p,
      adliScore: latestAdliByProcess.get(p.id) ?? null,
    })),
    compliance,
    growth: {
      improvementCount: improvementCount ?? 0,
      taskCompletionRate,
      totalTasks,
      completedTasks: completedTasksTotal,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetAuthId } = await params;
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only the user themselves (or an admin) can mark onboarding complete
  const { data: myRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  const role = myRole?.role ?? "member";
  if (!isAdminRole(role) && user.id !== targetAuthId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (body.action !== "complete-onboarding") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_roles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("auth_id", targetAuthId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/api/owner/[id]/route.ts
git commit -m "feat: add scorecard API route GET+POST /api/owner/[id]"
```

---

## Task 4: Scorecard Page `/owner/[id]`

**Files:**
- Create: `app/owner/[id]/page.tsx`

**Step 1: Write the page**

```typescript
// app/owner/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import { Card } from "@/components/ui";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────

interface ScorecardData {
  owner: {
    auth_id: string;
    email: string;
    full_name: string | null;
    role: string;
    last_login_at: string | null;
    onboarding_completed_at: string | null;
  };
  processes: {
    id: number;
    name: string;
    status: string;
    updated_at: string;
    process_type: string;
    adliScore: number | null;
  }[];
  compliance: {
    isCompliant: boolean;
    checks: {
      onboardingComplete: boolean;
      metricsAllCurrent: boolean;
      processRecentlyUpdated: boolean;
      taskCompletedThisQuarter: boolean;
      processStatusAcceptable: boolean;
    };
  };
  growth: {
    improvementCount: number;
    taskCompletionRate: number | null;
    totalTasks: number;
    completedTasks: number;
  };
}

// ── Sub-components ────────────────────────────────────────────

function CheckRow({ label, passing, detail }: { label: string; passing: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        passing ? "bg-nia-green/20 text-nia-green" : "bg-red-100 text-red-600"
      }`}>
        {passing ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function StatPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface-subtle rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
      <div className="text-xs text-text-secondary mt-1">{label}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function OwnerScorecardPage() {
  const params = useParams();
  const targetId = params.id as string;
  const { role, loading: roleLoading } = useRole();
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    fetch(`/api/owner/${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [targetId, roleLoading]);

  if (loading || roleLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-surface-subtle rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
          <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data || (data as { error?: string }).error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 text-center text-text-muted">
          Scorecard not available. You may not have permission to view this page.
        </Card>
      </div>
    );
  }

  const isSelf = currentUserId === targetId;
  const isAdmin = role === "admin" || role === "super_admin";
  const displayName = data.owner.full_name ?? data.owner.email;
  const pageTitle = isSelf ? "My Scorecard" : `${displayName}'s Scorecard`;

  const checks = data.compliance.checks;
  const checkItems = [
    {
      label: "Onboarding complete",
      passing: checks.onboardingComplete,
      detail: checks.onboardingComplete
        ? "Orientation program finished"
        : "Complete the onboarding program to get started",
    },
    {
      label: "Metrics current",
      passing: checks.metricsAllCurrent,
      detail: checks.metricsAllCurrent
        ? "All linked metrics logged within their cadence window"
        : "One or more metrics are overdue — visit Data Health to review",
    },
    {
      label: "Process recently updated",
      passing: checks.processRecentlyUpdated,
      detail: checks.processRecentlyUpdated
        ? "Documentation updated within the last 90 days"
        : "No process documentation has been updated in 90+ days",
    },
    {
      label: "Task completed this quarter",
      passing: checks.taskCompletedThisQuarter,
      detail: checks.taskCompletedThisQuarter
        ? "At least one task completed in the last 90 days"
        : "No tasks completed in the last 90 days — check the Tasks tab on your processes",
    },
    {
      label: "Process status acceptable",
      passing: checks.processStatusAcceptable,
      detail: checks.processStatusAcceptable
        ? "At least one process is Ready for Review or Approved"
        : "All processes are still in Draft — advance at least one to Ready for Review",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">{pageTitle}</h1>
          <p className="text-text-muted mt-1">
            {data.processes.length} process{data.processes.length !== 1 ? "es" : ""} owned
            {data.owner.last_login_at && (
              <> · Last active {new Date(data.owner.last_login_at).toLocaleDateString()}</>
            )}
          </p>
        </div>

        {/* Overall compliance badge */}
        <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
          data.compliance.isCompliant
            ? "bg-nia-green/10 text-nia-green border border-nia-green/30"
            : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          {data.compliance.isCompliant ? "✓ Compliant" : "⚠ Not Compliant"}
        </div>
      </div>

      {/* Onboarding prompt (if not complete and viewing self) */}
      {isSelf && !checks.onboardingComplete && (
        <div className="bg-nia-orange/10 border border-nia-orange/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Complete your onboarding</p>
            <p className="text-sm text-text-muted">Learn how to use the Hub and what's expected of you as a process owner.</p>
          </div>
          <a
            href="/onboarding"
            className="px-4 py-2 bg-nia-dark-solid text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap ml-4"
          >
            Start Onboarding →
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compliance Panel */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Activity Compliance</h2>
          <p className="text-xs text-text-muted mb-4">All checks must pass to be considered compliant</p>
          <div>
            {checkItems.map((item) => (
              <CheckRow key={item.label} {...item} />
            ))}
          </div>
        </Card>

        {/* Growth Panel */}
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Growth Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatPill
                label="Task Completion Rate"
                value={data.growth.taskCompletionRate !== null ? `${data.growth.taskCompletionRate}%` : "—"}
                sub={`${data.growth.completedTasks} of ${data.growth.totalTasks} tasks`}
              />
              <StatPill
                label="Improvements This Year"
                value={data.growth.improvementCount}
                sub="journal entries logged"
              />
            </div>
          </Card>

          {/* Processes */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Owned Processes</h2>
            {data.processes.length === 0 ? (
              <p className="text-sm text-text-muted">No processes assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {data.processes.map((p) => (
                  <Link
                    key={p.id}
                    href={`/processes/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-subtle transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-nia-dark transition-colors">
                        {p.name}
                      </p>
                      <p className="text-xs text-text-muted capitalize">
                        {p.status.replace(/_/g, " ")} · {p.process_type}
                      </p>
                    </div>
                    {p.adliScore !== null && (
                      <span className="text-xs font-semibold text-text-secondary bg-surface-subtle px-2 py-1 rounded">
                        ADLI {p.adliScore}/5
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Admin-only: back to scorecards */}
      {isAdmin && (
        <div>
          <Link href="/admin/scorecards" className="text-sm text-text-muted hover:text-foreground transition-colors">
            ← Back to all scorecards
          </Link>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Smoke test** — run the dev server and visit `/owner/[your-auth-id]`. Verify: compliance panel renders, checks show green/red, processes list shows correctly.

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add app/owner/[id]/page.tsx
git commit -m "feat: add process owner scorecard page /owner/[id]"
```

---

## Task 5: Admin Scorecards Overview Page

**Files:**
- Create: `app/admin/scorecards/page.tsx`
- Create: `app/api/admin/scorecards/route.ts`

**Step 1: Write the API route**

```typescript
// app/api/admin/scorecards/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole } from "@/lib/auth-helpers";
import { computeCompliance } from "@/lib/compliance";

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: myRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!isAdminRole(myRole?.role ?? "member")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all registered users
  const { data: users } = await supabase
    .from("user_roles")
    .select("auth_id, email, full_name, role, last_login_at, onboarding_completed_at")
    .order("full_name");

  if (!users) return NextResponse.json({ scorecards: [] });

  // For each user, compute compliance
  // Batch fetch all processes, then assign to owners
  const { data: allProcesses } = await supabase
    .from("processes")
    .select("id, name, status, updated_at, owner");

  const processIds = (allProcesses ?? []).map((p) => p.id);

  // Fetch metric links
  const { data: metricLinks } = processIds.length > 0
    ? await supabase
        .from("metric_processes")
        .select("process_id, metrics(id, cadence)")
        .in("process_id", processIds)
    : { data: [] };

  const metricIds = (metricLinks ?? [])
    .flatMap((ml) => (ml.metrics ? [ml.metrics as { id: number; cadence: string }] : []))
    .map((m) => m.id);

  const { data: latestEntries } = metricIds.length > 0
    ? await supabase
        .from("entries")
        .select("metric_id, date")
        .in("metric_id", metricIds)
        .order("date", { ascending: false })
    : { data: [] };

  const latestByMetric = new Map<number, string>();
  for (const e of latestEntries ?? []) {
    if (!latestByMetric.has(e.metric_id)) latestByMetric.set(e.metric_id, e.date);
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: completedTasks } = processIds.length > 0
    ? await supabase
        .from("process_tasks")
        .select("process_id, completed_at")
        .in("process_id", processIds)
        .eq("completed", true)
        .gte("completed_at", ninetyDaysAgo.toISOString())
    : { data: [] };

  // Build scorecards for each user
  const scorecards = users.map((u) => {
    const ownerName = u.full_name ?? u.email;
    const userProcesses = (allProcesses ?? []).filter((p) => p.owner === ownerName);
    const userProcessIds = new Set(userProcesses.map((p) => p.id));

    const processesForCompliance = userProcesses.map((p) => {
      const pMetrics = (metricLinks ?? [])
        .filter((ml) => ml.process_id === p.id)
        .flatMap((ml) => (ml.metrics ? [ml.metrics as { id: number; cadence: string }] : []));

      return {
        updated_at: p.updated_at,
        status: p.status,
        metrics: pMetrics.map((m) => ({
          cadence: m.cadence,
          lastEntryDate: latestByMetric.get(m.id) ?? null,
        })),
        tasksCompletedDates: (completedTasks ?? [])
          .filter((t) => userProcessIds.has(t.process_id) && t.completed_at)
          .map((t) => t.completed_at as string),
      };
    });

    const compliance = computeCompliance({
      onboardingCompletedAt: u.onboarding_completed_at,
      processes: processesForCompliance,
    });

    return {
      ...u,
      processCount: userProcesses.length,
      compliance,
    };
  });

  // Sort: non-compliant first, then by name
  scorecards.sort((a, b) => {
    if (a.compliance.isCompliant !== b.compliance.isCompliant) {
      return a.compliance.isCompliant ? 1 : -1;
    }
    return (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email);
  });

  return NextResponse.json({ scorecards });
}
```

**Step 2: Write the scorecards page**

```typescript
// app/admin/scorecards/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/use-role";
import { Card } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Scorecard {
  auth_id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_login_at: string | null;
  processCount: number;
  compliance: {
    isCompliant: boolean;
    checks: Record<string, boolean>;
  };
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ScorecardsPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const router = useRouter();
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) { router.push("/"); return; }

    fetch("/api/admin/scorecards")
      .then((r) => r.json())
      .then((d) => {
        setScorecards(d.scorecards ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAdmin, roleLoading, router]);

  const compliantCount = scorecards.filter((s) => s.compliance.isCompliant).length;

  if (loading || roleLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-surface-subtle rounded animate-pulse" />
        <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-nia-dark">Process Owner Scorecards</h1>
        <p className="text-text-muted mt-1">
          {compliantCount} of {scorecards.length} process owner{scorecards.length !== 1 ? "s" : ""} compliant
        </p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Name</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Processes</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Compliance</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Last Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {scorecards.map((s) => (
              <tr
                key={s.auth_id}
                className="border-b border-border last:border-0 hover:bg-surface-subtle transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{s.full_name ?? s.email}</p>
                  <p className="text-xs text-text-muted capitalize">{s.role.replace(/_/g, " ")}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">{s.processCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    s.compliance.isCompliant
                      ? "bg-nia-green/10 text-nia-green"
                      : "bg-red-50 text-red-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      s.compliance.isCompliant ? "bg-nia-green" : "bg-red-500"
                    }`} />
                    {s.compliance.isCompliant ? "Compliant" : "Not Compliant"}
                  </span>
                  {!s.compliance.isCompliant && (
                    <p className="text-xs text-text-muted mt-1">
                      {Object.values(s.compliance.checks).filter((v) => !v).length} check{Object.values(s.compliance.checks).filter((v) => !v).length !== 1 ? "s" : ""} failing
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{relativeTime(s.last_login_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/${s.auth_id}`}
                    className="text-xs text-nia-dark hover:underline font-medium"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {scorecards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No process owners registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Smoke test** — visit `/admin/scorecards`. Verify: table renders with all users, non-compliant rows appear first, clicking "View →" opens the scorecard page.

**Step 5: Commit**

```bash
git add app/api/admin/scorecards/route.ts app/admin/scorecards/page.tsx
git commit -m "feat: add admin scorecards overview page and API"
```

---

## Task 6: Onboarding Program Page

**Files:**
- Create: `app/onboarding/page.tsx`

This is a 4-chapter wizard. Each chapter is a full-screen step. Progress is saved in state; completion is written to the DB via POST to `/api/owner/[id]`.

**Step 1: Write the onboarding page**

```typescript
// app/onboarding/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ── Chapter content ────────────────────────────────────────────

const CHAPTERS = [
  {
    id: "why",
    title: "Why the Excellence Hub Exists",
    subtitle: "Chapter 1 of 4",
    content: [
      {
        heading: "NIA's Baldrige Journey",
        body: "Northwestern Illinois Association is pursuing recognition through the IIASA Continuous Improvement Program — a Baldrige-based framework for organizational excellence. The Excellence Hub is the platform that makes that pursuit systematic and visible.",
      },
      {
        heading: "What the Hub Is",
        body: "The Hub is where NIA documents its processes, tracks its performance metrics, manages improvement actions, and measures its readiness for Baldrige recognition. Every process you own in this system is a contribution to NIA's overall excellence.",
      },
      {
        heading: "Why Your Role Matters",
        body: "Process owners are the backbone of this system. Without active process owners documenting their work, updating their metrics, and driving improvements, the Hub is just a database. With engaged owners, it becomes evidence of a high-performing organization.",
      },
    ],
  },
  {
    id: "how",
    title: "How the Hub Works",
    subtitle: "Chapter 2 of 4",
    content: [
      {
        heading: "Process Health Score (0–100)",
        body: "Every process you own has a health score across five dimensions: Documentation (25 pts), Maturity (20 pts), Measurement (20 pts), Operations (20 pts), and Freshness (15 pts). Your job is to keep those scores moving up.",
      },
      {
        heading: "ADLI Maturity (1–5)",
        body: "ADLI stands for Approach, Deployment, Learning, and Integration — the four Baldrige dimensions of process maturity. Each is scored 1 to 5. The AI coach on your process page can help you score these and identify what to improve next.",
      },
      {
        heading: "Metrics and Data",
        body: "Processes are linked to performance metrics with defined review cadences (monthly, quarterly, semi-annual, annual). Your job is to make sure data gets entered on time. The Data Health page shows you which metrics are current, due soon, or overdue.",
      },
      {
        heading: "Tasks and Improvements",
        body: "The AI coach generates improvement tasks for each process. These sync to Asana so nothing falls through the cracks. Completing tasks is one of the signals the Hub uses to measure your engagement.",
      },
    ],
  },
  {
    id: "expectations",
    title: "Your Responsibilities",
    subtitle: "Chapter 3 of 4",
    content: [
      {
        heading: "The Standard",
        body: "NIA's expectation is simple: progress is acceptable, failure to use the Hub is not. You don't need to have a perfect score — you need to be actively working your processes.",
      },
      {
        heading: "What 'Active' Means",
        body: "You are considered compliant when you: (1) have completed this onboarding program, (2) keep all linked metrics entered within their cadence window, (3) update your process documentation at least once every 90 days, (4) complete at least one improvement task per quarter, and (5) have at least one process at Ready for Review or Approved status.",
      },
      {
        heading: "Your Scorecard",
        body: "You have a personal scorecard page that shows your compliance status and growth metrics. You can view it anytime from the sidebar. Jon and NIA leadership can also view it. The scorecard is not punitive — it's a tool to help you self-monitor and prioritize.",
      },
      {
        heading: "The Cadence",
        body: "Think of your Hub work in three rhythms: monthly (log data for monthly metrics), quarterly (update ADLI, complete a task, review your health score), and annually (full readiness review aligned to the IIASA application cycle).",
      },
    ],
  },
  {
    id: "start",
    title: "Your First Actions",
    subtitle: "Chapter 4 of 4",
    content: [
      {
        heading: "Step 1: Find Your Processes",
        body: "Go to the Processes page and filter by your name in the owner column. These are your processes. Click into each one to see the current state of the documentation.",
      },
      {
        heading: "Step 2: Review Your Health Score",
        body: "On each process page, you'll see a health score card. Click 'View Breakdown' to see which dimensions are lowest. That's where to focus first.",
      },
      {
        heading: "Step 3: Open the AI Coach",
        body: "Click 'AI Coach' on your process page. Ask it to score your ADLI maturity, or ask what the top three improvements would be. It knows your process data and will give you specific recommendations.",
      },
      {
        heading: "Step 4: Check Your Scorecard",
        body: "Visit your personal scorecard (My Scorecard in the sidebar) to see which compliance checks are passing and which need attention. Use this as your regular home base in the Hub.",
      },
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [chapter, setChapter] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    document.title = "Onboarding | NIA Excellence Hub";
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  async function handleComplete() {
    if (!userId) return;
    setCompleting(true);
    try {
      await fetch(`/api/owner/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      });
    } catch {
      // Non-fatal — they can retry later
    }
    router.push(`/owner/${userId}`);
  }

  const current = CHAPTERS[chapter];
  const isLast = chapter === CHAPTERS.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-surface-subtle">
        <div
          className="h-full bg-nia-dark-solid transition-all duration-500"
          style={{ width: `${((chapter + 1) / CHAPTERS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-6 py-12">
        {/* Chapter header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {current.subtitle}
          </p>
          <h1 className="text-3xl font-bold text-nia-dark">{current.title}</h1>
        </div>

        {/* Chapter content */}
        <div className="flex-1 space-y-6">
          {current.content.map((section) => (
            <div key={section.heading} className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2">{section.heading}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-1.5">
            {CHAPTERS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === chapter
                    ? "bg-nia-dark-solid"
                    : i < chapter
                    ? "bg-nia-green"
                    : "bg-surface-subtle"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {chapter > 0 && (
              <button
                onClick={() => setChapter((c) => c - 1)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="px-6 py-2 text-sm font-semibold text-white bg-nia-dark-solid hover:opacity-90 rounded-lg transition-opacity disabled:opacity-60"
              >
                {completing ? "Finishing…" : "Complete Onboarding →"}
              </button>
            ) : (
              <button
                onClick={() => setChapter((c) => c + 1)}
                className="px-6 py-2 text-sm font-semibold text-white bg-nia-dark-solid hover:opacity-90 rounded-lg transition-opacity"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Smoke test** — visit `/onboarding`. Step through all 4 chapters, click "Complete Onboarding". Verify: redirects to your scorecard, onboarding check now shows green.

**Step 4: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: add 4-chapter onboarding program page"
```

---

## Task 7: Sidebar Navigation Links

**Files:**
- Modify: `components/sidebar.tsx:16-80`

Add "My Scorecard" for all users in Overview, and "Scorecards" for admins in the Admin group.

**Step 1: Read the current sidebar nav**

Open `components/sidebar.tsx`. Locate the `navGroups` array (starts around line 16) and `adminNavGroups` array (starts around line 47).

**Step 2: Add "My Scorecard" to the Overview group**

In `navGroups`, after the `{ href: "/my-tasks", label: "My Tasks", icon: "check-circle" }` entry, add:

```typescript
{ href: "/my-scorecard", label: "My Scorecard", icon: "award" },
```

**Step 3: Add a redirect route for /my-scorecard**

Create `app/my-scorecard/page.tsx`:

```typescript
// app/my-scorecard/page.tsx
// Redirects to /owner/[current-user-id]
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function MyScorecardRedirect() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(`/owner/${user.id}`);
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return null;
}
```

**Step 4: Add "Scorecards" to the Admin group**

In `adminNavGroups`, add after the existing links:

```typescript
{ href: "/admin/scorecards", label: "Scorecards", icon: "users" },
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 6: Smoke test** — confirm "My Scorecard" appears in sidebar for all users, "Scorecards" appears in Admin section for admins only. Click each to verify navigation.

**Step 7: Commit and PR**

```bash
git add components/sidebar.tsx app/my-scorecard/page.tsx
git commit -m "feat: add My Scorecard and Scorecards sidebar links"

# Then create and merge the PR for the full feature branch
```

---

## Final: Create and Merge the Feature PR

After all tasks are committed on the feature branch:

```bash
gh pr create --title "feat: Process owner onboarding, scorecards, and compliance system" --body "..."
gh pr merge --merge --delete-branch
```

Verify in production:
1. Visit `/onboarding` — 4 chapters, completes successfully
2. Visit `/my-scorecard` — redirects to your scorecard with compliance panel
3. Visit `/admin/scorecards` — table of all users, non-compliant first
4. Click a name in scorecards — opens their `/owner/[id]` page
5. Check sidebar — "My Scorecard" visible, "Scorecards" visible in Admin section
