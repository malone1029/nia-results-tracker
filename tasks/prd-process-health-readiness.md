# PRD: Process Health & Baldrige Readiness System

## The Problem

NIA leaders need to do a huge amount of process work — documenting charters, writing ADLI narratives, linking Asana projects, logging metric data, running improvement cycles. The Hub only works if people **keep coming back** to update their processes.

Right now, there's no way to answer basic questions like:
- "How ready are we for a Baldrige application?"
- "Which processes need the most attention?"
- "Am I making progress, or am I stuck?"
- "What should I work on next?"

## The Strategy: Progress Visibility, Not Points

This isn't about points, badges, or leaderboards. NIA leaders are professionals — they don't need to "earn XP." Instead, we make **progress visible and gaps obvious**. The psychology:

1. **Completeness motivation** — People naturally want to fill incomplete things (the LinkedIn profile effect)
2. **Social accountability** — Seeing that your category is holding back the org creates healthy urgency
3. **Next-action clarity** — Removing the "what should I do?" friction makes it easy to keep going
4. **Celebration of effort** — Acknowledging work done reinforces the behavior

## Core Concept: Process Health Score

Every process gets a **Health Score** from 0-100 based on five dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| **Documentation** | 25% | Are charter + all 4 ADLI sections written? How detailed? |
| **Maturity** | 25% | ADLI assessment score (already exists as 0-100) |
| **Measurement** | 20% | Are metrics linked? Do they have recent data? LeTCI coverage? |
| **Operations** | 15% | Is this linked to Asana? Are tasks exported? Is it actively managed? |
| **Freshness** | 15% | When was this last updated? Has an improvement cycle run recently? |

### Scoring Details

**Documentation (0-25 points)**
- Charter exists and has content: 5 pts
- Each ADLI section filled (4 sections): 4 pts each = 16 pts
- Workflow documented: 2 pts
- Baldrige connections mapped: 2 pts

**Maturity (0-25 points)**
- Direct map from existing ADLI score: `overall_score * 0.25`
- Already calculated and stored in `process_adli_scores`

**Measurement (0-20 points)**
- Has 1+ linked metrics: 5 pts
- Has 3+ linked metrics: +3 pts (bonus)
- Linked metrics have recent data (within cadence): 4 pts
- At least one metric has LeTCI score of 3+: 4 pts
- At least one metric has a comparison value: 4 pts

**Operations (0-15 points)**
- Linked to Asana project: 5 pts
- ADLI tasks exported to Asana: 4 pts
- Has queued/exported improvement tasks: 3 pts
- Status is "approved" (not draft): 3 pts

**Freshness (0-15 points)**
- Updated in last 30 days: 15 pts
- Updated in last 60 days: 10 pts
- Updated in last 90 days: 5 pts
- Over 90 days: 0 pts
- (Uses `updated_at` or latest `process_improvements` date)

### Health Levels (same language as ADLI maturity)

| Score | Level | Color | Meaning |
|-------|-------|-------|---------|
| 80-100 | **Baldrige Ready** | NIA Green (#b1bd37) | Could be included in an application today |
| 60-79 | **On Track** | NIA Teal (#55787c) | Good progress, some gaps to close |
| 40-59 | **Developing** | NIA Orange (#f79935) | Foundation in place, needs significant work |
| 0-39 | **Getting Started** | Red (#dc2626) | Early stage, needs attention |

---

## User Stories (10 stories, 4 layers)

### Layer 1: Health Score Engine + Process List Enhancement

**Story 1: Calculate Process Health Scores**
As a system, I calculate a health score (0-100) for every process so that readiness data is always available.

- Create `lib/process-health.ts` with scoring logic
- Function takes a process + its related data (metrics, scores, improvements) and returns:
  ```
  {
    total: 73,
    level: "On Track",
    color: "#55787c",
    dimensions: {
      documentation: { score: 22, max: 25, details: [...] },
      maturity: { score: 18, max: 25, details: [...] },
      measurement: { score: 15, max: 20, details: [...] },
      operations: { score: 10, max: 15, details: [...] },
      freshness: { score: 8, max: 15, details: [...] }
    },
    nextActions: [
      "Add a comparison value to at least one metric",
      "Export your ADLI documentation to Asana",
      "Run an AI assessment to update your maturity scores"
    ]
  }
  ```
- `nextActions` are auto-generated: look at the lowest-scoring dimension and suggest the specific action that would gain the most points
- No new database table needed — calculated on-the-fly from existing data

**Story 2: Health Score on Process List**
As a process owner, I see each process's health score on the process list page so I can quickly spot which ones need attention.

- Replace the 5 completeness dots with a **health ring** (circular progress indicator)
- Ring color matches health level
- Score number shown in center of ring
- Hover tooltip shows dimension breakdown
- Sort option: "Sort by Health Score" (lowest first = needs most attention)

```
Current process row:
┌──────────────────────────────────────────────────────┐
│ Strategic Planning    Jon Malone    ●●●○○  Approved  │
│ Category 2                                    ⋮⋮⋮    │
└──────────────────────────────────────────────────────┘

New process row:
┌──────────────────────────────────────────────────────┐
│ ╭───╮                                               │
│ │73 │  Strategic Planning    Jon Malone    Approved  │
│ ╰───╯  Category 2                           ⋮⋮⋮     │
│        ▸ Next: Add comparison value to a metric      │
└──────────────────────────────────────────────────────┘
  (ring)  (the "next action" line only shows on hover)
```

**Story 3: Health Score Detail Card on Process Page**
As a process owner, I see a detailed health breakdown on my process page so I know exactly what to improve.

- New card at top of process detail page (below header, above content)
- Shows the 5 dimension bars with scores
- Each dimension expands to show what's earned vs. what's missing
- "Next Actions" section with 2-3 specific, clickable suggestions
- Clicking a suggestion navigates to the right place (e.g., "Link a metric" → edit page)

```
┌─ Process Health ──────────────────────────────────────┐
│                                                       │
│  ╭─────╮   On Track                                  │
│  │     │                                              │
│  │ 73  │   Documentation  ████████████████████░░  22/25│
│  │     │   Maturity       ██████████████░░░░░░░  18/25│
│  ╰─────╯   Measurement   ███████████████░░░░░░  15/20│
│  (ring)    Operations     ██████████░░░░░░░░░░  10/15│
│            Freshness      ██████░░░░░░░░░░░░░░   8/15│
│                                                       │
│  ▸ Next Actions                                       │
│    → Add a comparison value to "Response Time" metric │
│    → Export ADLI documentation to Asana                │
│    → Run an improvement cycle (last one: 47 days ago) │
└───────────────────────────────────────────────────────┘
```

---

### Layer 2: Org Readiness Dashboard (Lincoln Award View)

**Story 4: Org Readiness Overview**
As an NIA leader, I see an organization-wide Baldrige readiness view so I can understand how prepared we are overall.

- New page: `/readiness` (add to sidebar under "Readiness" heading)
- Top section: **Org Readiness Score** (average of all process health scores, weighted by `is_key`)
  - Key processes count 2x in the average (they matter more for Baldrige)
- Score displayed as large progress ring with level label
- Subtitle: "X of Y processes are Baldrige Ready"

```
┌─ NIA Baldrige Readiness ─────────────────────────────┐
│                                                       │
│      ╭─────────╮                                     │
│      │         │    Organization Readiness: 61%      │
│      │   61    │    Level: On Track                  │
│      │         │    5 of 18 processes Baldrige Ready  │
│      ╰─────────╯    12 Key Processes avg: 67%        │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Story 5: Category Readiness Breakdown**
As an NIA leader, I see readiness by Baldrige category so I know which areas of the organization are strongest and weakest.

- 7 Baldrige category cards (Leadership, Strategy, Customers, etc.)
- Each card shows:
  - Category average health score with color
  - Mini bar for each process in that category
  - Count: "3 of 5 processes Baldrige Ready"
- Categories sorted by score (weakest first = needs most attention)

```
┌─ Category Readiness ─────────────────────────────────┐
│                                                       │
│  ┌─ Cat 6: Operations ─────────┐  ┌─ Cat 1: Leadership ──────────┐
│  │ Avg: 45% (Developing)       │  │ Avg: 78% (On Track)          │
│  │ ████░░░░░░ 1 of 4 ready     │  │ ████████░░ 2 of 3 ready      │
│  │                              │  │                               │
│  │ Strategic Planning     73 ██│  │ Leadership System       82 ██│
│  │ Workforce Management   52 █░│  │ Governance              81 ██│
│  │ Knowledge Management   34 █░│  │ Societal Responsibility 71 █░│
│  │ IT Infrastructure      21 ░░│  │                               │
│  └──────────────────────────────┘  └───────────────────────────────┘
│                                                       │
│  ┌─ Cat 4: Measurement ────────┐  ┌─ Cat 7: Results ─────────────┐
│  │ Avg: 58% (Developing)       │  │ Avg: 72% (On Track)          │
│  │ ...                          │  │ ...                           │
│  └──────────────────────────────┘  └───────────────────────────────┘
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Story 6: Dimension Gap Analysis**
As an NIA leader, I see which health dimensions are weakest across the org so I can prioritize improvement efforts.

- Horizontal bar chart: all 5 health dimensions averaged across all processes
- Shows where the systemic gaps are (e.g., "Everyone's documentation is good, but nobody has comparison data")
- Below chart: "Top 5 Actions That Would Most Improve Readiness" — the next-actions from the lowest-scoring processes, deduplicated and ranked by impact

```
┌─ Org-Wide Dimension Health ──────────────────────────┐
│                                                       │
│  Documentation  ██████████████████░░░░  78%           │
│  Maturity       ████████████████░░░░░░  65%           │
│  Measurement    ████████████░░░░░░░░░░  52%  ← Gap   │
│  Operations     ██████████░░░░░░░░░░░░  44%  ← Gap   │
│  Freshness      ████████████████░░░░░░  62%           │
│                                                       │
│  Top Actions to Improve Readiness:                    │
│  1. Link 6 processes to Asana projects (+18 pts total)│
│  2. Add comparison values to 8 metrics (+16 pts total)│
│  3. Run improvement cycles on 4 stale processes       │
│  4. Complete ADLI sections on 3 draft processes       │
│  5. Export ADLI documentation for 5 linked processes  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

### Layer 3: Owner Accountability + Freshness

**Story 7: Owner Scorecard on Dashboard**
As a process owner, my dashboard shows my personal readiness scorecard so I feel ownership over my portfolio's health.

- Enhance existing dashboard (currently shows process count, avg ADLI, overdue metrics, Asana linked)
- Replace or enhance stat cards:
  - **My Readiness:** personal average health score (replaces "Avg ADLI")
  - **Baldrige Ready:** count of my processes at 80+ health (new)
  - **Needs Attention:** count of processes below 40 health or stale >60 days (replaces "Overdue Metrics")
  - **Overdue Metrics:** keep as-is (stays important)
- Add "My Next Actions" section below action items — the top 3 highest-impact actions across all my processes

**Story 8: Freshness Indicators on Process List**
As a process owner, I see how fresh/stale each process is so I know which ones haven't been touched in a while.

- Add "Last Activity" column (or subtitle) to process list
- Show relative time: "3 days ago", "2 months ago"
- Color coding:
  - Green: updated within 30 days
  - Gray: 31-60 days
  - Orange: 61-90 days
  - Red pulse: 90+ days (subtle animation, not aggressive)
- "Last Activity" = most recent of: `updated_at`, latest improvement date, latest entry date on linked metrics

---

### Layer 4: Milestones + Celebration

**Story 9: Milestone Moments**
As a process owner, I see brief celebrations when I hit meaningful milestones so I feel progress.

- Trigger milestone toasts (not modals — non-blocking) when:
  - Process reaches "Baldrige Ready" (80+ health) for the first time
  - All ADLI sections completed (documentation = 25/25)
  - First improvement cycle completed
  - Process linked to Asana for the first time
  - All linked metrics have current data
- Toast style: NIA green accent, brief text, auto-dismiss after 5 seconds
- Example: "Strategic Planning just hit Baldrige Ready status — great work!"
- **No persistence needed** — just detect the condition when loading the page and show once per session (sessionStorage flag)

**Story 10: Readiness Trend Over Time**
As an NIA leader, I see how org readiness has changed over time so I know if we're making progress toward Baldrige.

- Weekly snapshot: store org readiness score + per-category scores
- New table: `readiness_snapshots` (date, org_score, category_scores JSONB)
- Cron job or manual trigger: "Take Readiness Snapshot" button on readiness page
- Line chart showing readiness score over weeks/months
- Goal line: "Baldrige Application Target: 80%"

```
┌─ Readiness Trend ────────────────────────────────────┐
│                                                       │
│  100% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│   80% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Target ─ ─ ─  │
│   60% ─ ─ ─ ─ ─ ─ ─ ─ ╱─────●  61%                 │
│   40% ─ ─ ─ ─ ─ ╱────╱                               │
│   20% ─ ─ ●────╱                                     │
│    0% ─────────────────────────────────────────────── │
│        Jan   Feb   Mar   Apr   May   Jun              │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Layer | Stories | Impact | Effort | Do When |
|-------|---------|--------|--------|---------|
| **Layer 1** | 1-3 | Very High | Medium | **First** — foundation for everything else |
| **Layer 2** | 4-6 | Very High | Medium | **Second** — the "Phase 3" Lincoln Award view |
| **Layer 3** | 7-8 | High | Small | **Third** — quick wins on existing pages |
| **Layer 4** | 9-10 | Medium | Small-Medium | **Fourth** — polish and long-term tracking |

## Technical Notes

- **No new database tables** for Layers 1-3 (health score is calculated on-the-fly from existing data)
- **One new table** for Layer 4 Story 10: `readiness_snapshots`
- Health score calculation lives in a shared `lib/process-health.ts` — used by process list, process detail, dashboard, and readiness page
- For the readiness page, fetch all processes + scores + metrics in parallel (same `Promise.all` pattern used elsewhere)
- The "Next Actions" engine is the most valuable part — it answers "what should I do next?" with specifics

## What This Is NOT

- No points or XP
- No competitive leaderboards (owners see their own portfolio, not rankings)
- No daily login rewards
- No arbitrary badges
- No notifications or emails nagging people

It's **a mirror** — it shows you where you are, where you need to be, and what to do next. The motivation comes from seeing your own progress (or lack thereof) clearly.
