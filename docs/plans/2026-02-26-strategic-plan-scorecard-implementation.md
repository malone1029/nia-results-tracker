# Strategic Plan & Balanced Scorecard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Strategic Plan module with a live Balanced Scorecard dashboard that links NIA's 10 FY26 strategic objectives to existing Hub metrics and processes, filling the Baldrige Category 2 gap.

**Architecture:** Two new DB tables (`strategic_objectives`, `process_objectives`), five API routes, a single `/strategy` page with Scorecard and Objectives tabs, a Strategic Objectives checkbox section added to each process page, and a new STRATEGY sidebar section. Three compute types handle live data: `metric` (pulls from existing metrics), `adli_threshold` (auto-counts processes with ADLI ≥ 70), and `manual` (admin-entered).

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (Postgres + RLS), existing `useRole()` hook for access control, existing `Card`/`Badge`/`Button` UI primitives.

**Key metric IDs for seed:** BSS Overall Mean = 265, EE Overall Mean = 199, MDS Overall Mean = 258.

---

## Task 1: Database migration — tables + enums

**Files:**

- Create: `supabase/migrations/20260226000000_strategic-objectives.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260226000000_strategic-objectives.sql

CREATE TYPE bsc_perspective AS ENUM (
  'financial',
  'org_capacity',
  'internal_process',
  'customer'
);

CREATE TYPE objective_compute_type AS ENUM (
  'metric',
  'adli_threshold',
  'manual'
);

CREATE TABLE strategic_objectives (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  bsc_perspective  bsc_perspective NOT NULL,
  target_value     NUMERIC,
  target_unit      TEXT,
  target_year      INT,
  compute_type     objective_compute_type NOT NULL DEFAULT 'manual',
  linked_metric_id INT REFERENCES metrics(id) ON DELETE SET NULL,
  current_value    NUMERIC,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE process_objectives (
  id           SERIAL PRIMARY KEY,
  process_id   INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  objective_id INT NOT NULL REFERENCES strategic_objectives(id) ON DELETE CASCADE,
  UNIQUE (process_id, objective_id)
);

-- RLS: all authenticated users can read; only service_role can write
ALTER TABLE strategic_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategic_objectives_read" ON strategic_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "process_objectives_read" ON process_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "process_objectives_insert" ON process_objectives
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "process_objectives_delete" ON process_objectives
  FOR DELETE TO authenticated USING (true);
```

**Step 2: Push migration**

```bash
cd ~/projects/nia-results-tracker
supabase db push
```

Expected: migration applied with no errors.

**Step 3: Commit**

```bash
git checkout -b jon/strategic-plan-scorecard
git add supabase/migrations/20260226000000_strategic-objectives.sql
git commit -m "feat: add strategic_objectives and process_objectives tables"
```

---

## Task 2: Seed migration — 10 FY26 strategic goals

**Files:**

- Create: `supabase/migrations/20260226000001_seed-strategic-objectives.sql`

**Step 1: Write the seed migration**

```sql
-- supabase/migrations/20260226000001_seed-strategic-objectives.sql

INSERT INTO strategic_objectives
  (title, description, bsc_perspective, target_value, target_unit, target_year, compute_type, linked_metric_id, current_value, sort_order)
VALUES
  -- Financial
  ('FY25 budget surplus',
   'Finish FY25 with a 1–3% budget surplus. Status: Not Met.',
   'financial', 3, '%', 2025, 'manual', NULL, NULL, 1),

  ('FY26 budget surplus',
   'Finish FY26 with a 1–3% budget surplus.',
   'financial', 3, '%', 2026, 'manual', NULL, NULL, 2),

  ('FY27 budget surplus',
   'Finish FY27 with a 1–3% budget surplus.',
   'financial', 3, '%', 2027, 'manual', NULL, NULL, 3),

  -- Organizational Capacity
  ('Train 50 teammates in PDCA/Quality',
   'Provide training in Quality and Process Improvement for 50 teammates during FY26.',
   'org_capacity', 50, 'teammates', 2026, 'manual', NULL, NULL, 4),

  ('Teammate retention',
   'Retain a target percentage of teammates year over year. Target TBD pending baseline data.',
   'org_capacity', NULL, '%', 2026, 'manual', NULL, NULL, 5),

  ('BST satisfaction ≥ 4.5',
   'Maintain internal satisfaction with Business Services Departments at 4.5 or higher (Studer BSS Survey Overall Mean).',
   'org_capacity', 4.5, 'score', 2026, 'metric', 265, NULL, 6),

  ('Employee engagement ≥ 4.5',
   'Maintain Employee Engagement at 4.5 or higher (Studer EE Survey Overall Mean).',
   'org_capacity', 4.5, 'score', 2026, 'metric', 199, NULL, 7),

  -- Internal Process
  ('20 processes with ADLI ≥ 70',
   'Demonstrate process maturity by achieving an ADLI overall score of 70 or higher in 20 or more NIA processes as assessed through the Excellence Hub by June 2026.',
   'internal_process', 20, 'processes', 2026, 'adli_threshold', NULL, NULL, 8),

  -- Customer
  ('Maintain/increase active customers',
   'Maintain or increase active purchasing customers from the previous fiscal year.',
   'customer', NULL, 'customers', 2026, 'manual', NULL, NULL, 9),

  ('Customer satisfaction ≥ 4.5',
   'Maintain Customer Satisfaction at 4.5 or higher (Studer MDS Survey Overall Mean).',
   'customer', 4.5, 'score', 2026, 'metric', 258, NULL, 10);
```

**Step 2: Push migration**

```bash
supabase db push
```

Expected: 10 rows inserted into `strategic_objectives`.

**Step 3: Commit**

```bash
git add supabase/migrations/20260226000001_seed-strategic-objectives.sql
git commit -m "feat: seed 10 FY26 strategic objectives"
```

---

## Task 3: TypeScript types

**Files:**

- Modify: `lib/types.ts`

**Step 1: Add types at the end of the file**

```typescript
// ── Strategic Objectives ──────────────────────────────────────

export type BscPerspective = 'financial' | 'org_capacity' | 'internal_process' | 'customer';
export type ObjectiveComputeType = 'metric' | 'adli_threshold' | 'manual';
export type ObjectiveStatus = 'green' | 'yellow' | 'red' | 'no-data';

export interface StrategicObjective {
  id: number;
  title: string;
  description: string | null;
  bsc_perspective: BscPerspective;
  target_value: number | null;
  target_unit: string | null;
  target_year: number | null;
  compute_type: ObjectiveComputeType;
  linked_metric_id: number | null;
  current_value: number | null;
  sort_order: number;
  created_at: string;
}

export interface StrategicObjectiveWithStatus extends StrategicObjective {
  computed_value: number | null;
  status: ObjectiveStatus;
  linked_process_count: number;
  trend_direction: 'improving' | 'declining' | 'flat' | 'no-data';
}
```

**Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add StrategicObjective types"
```

---

## Task 4: GET /api/strategy route

**Files:**

- Create: `app/api/strategy/route.ts`

**Step 1: Write the route**

```typescript
// app/api/strategy/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import type { BscPerspective, ObjectiveStatus, StrategicObjectiveWithStatus } from '@/lib/types';

function computeStatus(current: number | null, target: number | null): ObjectiveStatus {
  if (current === null || target === null) return 'no-data';
  if (current >= target) return 'green';
  if (current >= target * 0.9) return 'yellow';
  return 'red';
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all objectives
  const { data: objectives, error } = await supabase
    .from('strategic_objectives')
    .select('*')
    .order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch linked process counts
  const { data: procLinks } = await supabase.from('process_objectives').select('objective_id');
  const procCountByObjective = new Map<number, number>();
  for (const link of procLinks ?? []) {
    procCountByObjective.set(
      link.objective_id,
      (procCountByObjective.get(link.objective_id) ?? 0) + 1
    );
  }

  // For metric-type objectives: fetch latest entries + trend
  const metricIds = (objectives ?? [])
    .filter((o) => o.compute_type === 'metric' && o.linked_metric_id)
    .map((o) => o.linked_metric_id as number);

  const { data: entries } =
    metricIds.length > 0
      ? await supabase
          .from('entries')
          .select('metric_id, value, date')
          .in('metric_id', metricIds)
          .order('date', { ascending: true })
      : { data: [] };

  // Build latest value + trend per metric
  const latestByMetric = new Map<number, number>();
  const valuesByMetric = new Map<number, number[]>();
  for (const e of entries ?? []) {
    latestByMetric.set(e.metric_id, e.value);
    if (!valuesByMetric.has(e.metric_id)) valuesByMetric.set(e.metric_id, []);
    valuesByMetric.get(e.metric_id)!.push(e.value);
  }

  // For adli_threshold objectives: count processes with ADLI >= 70
  const { count: adliCount } = await supabase
    .from('process_adli_scores')
    .select('process_id', { count: 'exact', head: false })
    .gte('overall_score', 70);

  // Distinct count — latest score per process
  const { data: adliRows } = await supabase
    .from('process_adli_scores')
    .select('process_id, overall_score, assessed_at')
    .order('assessed_at', { ascending: false });

  const latestAdliByProcess = new Map<number, number>();
  for (const row of adliRows ?? []) {
    if (!latestAdliByProcess.has(row.process_id)) {
      latestAdliByProcess.set(row.process_id, row.overall_score);
    }
  }
  const adliThresholdCount = [...latestAdliByProcess.values()].filter((s) => s >= 70).length;

  function getTrend(values: number[]): 'improving' | 'declining' | 'flat' | 'no-data' {
    if (values.length < 2) return 'no-data';
    const last = values[values.length - 1];
    const prev = values[values.length - 2];
    if (last > prev) return 'improving';
    if (last < prev) return 'declining';
    return 'flat';
  }

  const enriched: StrategicObjectiveWithStatus[] = (objectives ?? []).map((obj) => {
    let computed_value: number | null = null;
    let trend_direction: 'improving' | 'declining' | 'flat' | 'no-data' = 'no-data';

    if (obj.compute_type === 'metric' && obj.linked_metric_id) {
      computed_value = latestByMetric.get(obj.linked_metric_id) ?? null;
      trend_direction = getTrend(valuesByMetric.get(obj.linked_metric_id) ?? []);
    } else if (obj.compute_type === 'adli_threshold') {
      computed_value = adliThresholdCount;
      trend_direction = 'no-data';
    } else {
      computed_value = obj.current_value;
    }

    return {
      ...obj,
      bsc_perspective: obj.bsc_perspective as BscPerspective,
      computed_value,
      status: computeStatus(computed_value, obj.target_value),
      linked_process_count: procCountByObjective.get(obj.id) ?? 0,
      trend_direction,
    };
  });

  return NextResponse.json(enriched);
}
```

**Step 2: Commit**

```bash
git add app/api/strategy/route.ts
git commit -m "feat: add GET /api/strategy with compute_type handling"
```

---

## Task 5: POST /api/strategy and PATCH/DELETE /api/strategy/[id]

**Files:**

- Modify: `app/api/strategy/route.ts` (add POST)
- Create: `app/api/strategy/[id]/route.ts`

**Step 1: Add POST to route.ts**

```typescript
// Add to app/api/strategy/route.ts

import { isAdminRole } from '@/lib/auth-helpers';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (roleRow?.role !== 'super_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabase
    .from('strategic_objectives')
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

**Step 2: Write [id]/route.ts**

```typescript
// app/api/strategy/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (roleRow?.role !== 'super_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabase
    .from('strategic_objectives')
    .update(body)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (roleRow?.role !== 'super_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabase.from('process_objectives').delete().eq('objective_id', id);
  const { error } = await supabase.from('strategic_objectives').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

**Step 3: Commit**

```bash
git add app/api/strategy/route.ts app/api/strategy/[id]/route.ts
git commit -m "feat: add POST/PATCH/DELETE strategy API routes"
```

---

## Task 6: Process-objective link/unlink route

**Files:**

- Create: `app/api/strategy/[id]/processes/route.ts`

**Step 1: Write the route**

```typescript
// app/api/strategy/[id]/processes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: objectiveId } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { process_id } = await req.json();
  const { error } = await supabase
    .from('process_objectives')
    .insert({ process_id, objective_id: Number(objectiveId) });
  if (error && error.code !== '23505')
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: objectiveId } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { process_id } = await req.json();
  const { error } = await supabase
    .from('process_objectives')
    .delete()
    .eq('process_id', process_id)
    .eq('objective_id', Number(objectiveId));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

**Step 2: Commit**

```bash
git add 'app/api/strategy/[id]/processes/route.ts'
git commit -m "feat: add process-objective link/unlink API route"
```

---

## Task 7: /strategy page — Scorecard tab

**Files:**

- Create: `app/strategy/page.tsx`

**Step 1: Write the page**

```typescript
// app/strategy/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/use-role";
import { Card, Badge } from "@/components/ui";
import type { BscPerspective, StrategicObjectiveWithStatus, ObjectiveStatus } from "@/lib/types";

const PERSPECTIVES: { key: BscPerspective; label: string; description: string }[] = [
  { key: "financial", label: "Financial Stability", description: "Ensure resources to fulfill mission" },
  { key: "org_capacity", label: "Organizational Capacity", description: "Invest in people, tools, knowledge" },
  { key: "internal_process", label: "Internal Processes", description: "Improve efficiency and service quality" },
  { key: "customer", label: "Customer Satisfaction", description: "Retain and delight member districts" },
];

function statusColor(s: ObjectiveStatus) {
  switch (s) {
    case "green": return "#b1bd37";
    case "yellow": return "#f79935";
    case "red": return "#dc2626";
    default: return "var(--grid-line)";
  }
}

function trendIcon(t: string) {
  switch (t) {
    case "improving": return "↑";
    case "declining": return "↓";
    case "flat": return "→";
    default: return "—";
  }
}

function ObjectiveRow({ obj }: { obj: StrategicObjectiveWithStatus }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-light last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-foreground truncate">{obj.title}</p>
        {obj.target_value !== null && (
          <p className="text-xs text-text-muted mt-0.5">
            Target: {obj.target_value}{obj.target_unit ? ` ${obj.target_unit}` : ""}
            {obj.target_year ? ` by FY${String(obj.target_year).slice(2)}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {obj.computed_value !== null ? (
          <span className="text-sm font-semibold text-foreground">
            {obj.computed_value}
            {obj.target_value !== null && (
              <span className="text-xs text-text-muted font-normal"> / {obj.target_value}</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-text-muted">No data</span>
        )}
        <span className="text-sm" style={{ color: obj.trend_direction === "improving" ? "#b1bd37" : obj.trend_direction === "declining" ? "#dc2626" : "var(--text-muted)" }}>
          {trendIcon(obj.trend_direction)}
        </span>
        {obj.linked_process_count > 0 && (
          <Badge color="gray" size="xs">{obj.linked_process_count} process{obj.linked_process_count !== 1 ? "es" : ""}</Badge>
        )}
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor(obj.status) }} />
      </div>
    </div>
  );
}

export default function StrategyPage() {
  const { role } = useRole();
  const [objectives, setObjectives] = useState<StrategicObjectiveWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"scorecard" | "objectives">("scorecard");
  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    document.title = "Strategic Plan | NIA Excellence Hub";
    fetch("/api/strategy")
      .then((r) => r.json())
      .then((d) => { setObjectives(d); setLoading(false); });
  }, []);

  const onTrackCount = objectives.filter((o) => o.status === "green").length;

  const byPerspective = (p: BscPerspective) => objectives.filter((o) => o.bsc_perspective === p);

  if (loading) return <div className="max-w-5xl mx-auto space-y-4"><div className="h-8 w-64 bg-surface-subtle rounded animate-pulse" /><div className="grid grid-cols-2 gap-4"><div className="h-64 bg-surface-subtle rounded-xl animate-pulse" /><div className="h-64 bg-surface-subtle rounded-xl animate-pulse" /><div className="h-64 bg-surface-subtle rounded-xl animate-pulse" /><div className="h-64 bg-surface-subtle rounded-xl animate-pulse" /></div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Strategic Plan</h1>
          <p className="text-text-muted mt-1">FY2026 Balanced Scorecard — NIA Excellence Framework</p>
        </div>
        <div className="text-sm font-medium px-3 py-1.5 rounded-full bg-nia-green/10 text-nia-green border border-nia-green/20">
          {onTrackCount} / {objectives.length} on track
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-light">
        {(["scorecard", "objectives"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-nia-dark-solid text-foreground"
                : "border-transparent text-text-muted hover:text-foreground"
            }`}
          >
            {tab === "scorecard" ? "Scorecard" : "Objectives"}
          </button>
        ))}
      </div>

      {/* Scorecard tab */}
      {activeTab === "scorecard" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PERSPECTIVES.map((p) => {
            const objs = byPerspective(p.key);
            const onTrack = objs.filter((o) => o.status === "green").length;
            return (
              <Card key={p.key} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{p.label}</h2>
                    <p className="text-xs text-text-muted mt-0.5">{p.description}</p>
                  </div>
                  <span className="text-xs text-text-muted">{onTrack}/{objs.length}</span>
                </div>
                {objs.length === 0 ? (
                  <p className="text-sm text-text-muted italic">No objectives in this perspective.</p>
                ) : (
                  objs.map((obj) => <ObjectiveRow key={obj.id} obj={obj} />)
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Objectives tab — placeholder for Task 8 */}
      {activeTab === "objectives" && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Objectives management coming in next step.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/strategy/page.tsx
git commit -m "feat: add /strategy page with Scorecard tab"
```

---

## Task 8: Objectives tab (list + super admin edit)

**Files:**

- Modify: `app/strategy/page.tsx`

**Step 1: Replace the objectives tab placeholder with full implementation**

Replace the objectives tab section with:

```typescript
{/* Objectives tab */}
{activeTab === "objectives" && (
  <div className="space-y-6">
    {PERSPECTIVES.map((p) => {
      const objs = byPerspective(p.key);
      return (
        <div key={p.key}>
          <h2 className="text-base font-semibold text-foreground mb-3">{p.label}</h2>
          <div className="space-y-2">
            {objs.map((obj) => (
              <Card key={obj.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{obj.title}</p>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor(obj.status) }} />
                    </div>
                    {obj.description && (
                      <p className="text-xs text-text-muted mt-1">{obj.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-muted">
                      {obj.target_value !== null && (
                        <span>Target: <strong className="text-foreground">{obj.target_value} {obj.target_unit}</strong></span>
                      )}
                      {obj.computed_value !== null && (
                        <span>Current: <strong className="text-foreground">{obj.computed_value}</strong></span>
                      )}
                      <span>Compute: <strong className="text-foreground">{obj.compute_type}</strong></span>
                      <span>{obj.linked_process_count} process{obj.linked_process_count !== 1 ? "es" : ""} linked</span>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => {/* open edit modal — future enhancement */}}
                        className="text-xs text-nia-grey-blue hover:text-nia-dark transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {isSuperAdmin && (
              <button className="text-sm text-nia-grey-blue hover:text-nia-dark transition-colors font-medium">
                + Add Objective
              </button>
            )}
          </div>
        </div>
      );
    })}
  </div>
)}
```

**Step 2: Commit**

```bash
git add app/strategy/page.tsx
git commit -m "feat: add Objectives tab to strategy page"
```

---

## Task 9: Process page — Strategic Objectives section

**Files:**

- Modify: `app/processes/[id]/page.tsx`

**Step 1: Find the Requirements section on the process Overview tab**

Search for where `key_requirements` or `process_requirements` is rendered in `app/processes/[id]/page.tsx`. The Strategic Objectives section goes directly below it.

**Step 2: Add state and data fetching**

Add to the existing `useEffect` data fetch in the process page:

```typescript
// Add to the process page data fetch
const { data: allObjectives } = await supabase
  .from('strategic_objectives')
  .select('id, title, bsc_perspective')
  .order('sort_order');

const { data: linkedObjectives } = await supabase
  .from('process_objectives')
  .select('objective_id')
  .eq('process_id', processId);

const linkedObjectiveIds = new Set((linkedObjectives ?? []).map((l) => l.objective_id));
```

**Step 3: Add the Strategic Objectives checkbox section in the Overview tab JSX**

Place this below the Requirements section:

```tsx
{
  /* Strategic Objectives */
}
<div className="mt-6">
  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
    Strategic Objectives
  </h3>
  {(allObjectives ?? []).length === 0 ? (
    <p className="text-sm text-text-muted italic">No strategic objectives defined yet.</p>
  ) : (
    <div className="space-y-1">
      {(allObjectives ?? []).map((obj) => {
        const isLinked = linkedObjectiveIds.has(obj.id);
        return (
          <label
            key={obj.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={isLinked}
              onChange={async () => {
                if (isLinked) {
                  await fetch(`/api/strategy/${obj.id}/processes`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ process_id: processId }),
                  });
                  linkedObjectiveIds.delete(obj.id);
                } else {
                  await fetch(`/api/strategy/${obj.id}/processes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ process_id: processId }),
                  });
                  linkedObjectiveIds.add(obj.id);
                }
                setRefreshKey((k) => k + 1);
              }}
              className="w-4 h-4 rounded border-border accent-nia-dark-solid"
            />
            <span className="text-sm text-foreground">{obj.title}</span>
            <span className="text-xs text-text-muted capitalize ml-auto">
              {obj.bsc_perspective.replace('_', ' ')}
            </span>
          </label>
        );
      })}
    </div>
  )}
</div>;
```

**Step 4: Commit**

```bash
git add 'app/processes/[id]/page.tsx'
git commit -m "feat: add Strategic Objectives checkbox section to process page"
```

---

## Task 10: Sidebar restructuring

**Files:**

- Modify: `components/sidebar.tsx`

**Step 1: Find the sidebar nav sections**

Search for "Requirements" in `components/sidebar.tsx` — it's currently in the Overview section. Find its NavLink entry.

**Step 2: Remove Requirements from Overview, add STRATEGY section**

Find the Overview section links and remove the Requirements entry. Then add a new STRATEGY section between Overview and Processes:

```tsx
{
  /* STRATEGY */
}
<SidebarSection label="Strategy">
  <NavLink href="/requirements" icon="clipboard-list">
    Requirements
  </NavLink>
  <NavLink href="/strategy" icon="chart-bar">
    Strategic Plan
  </NavLink>
</SidebarSection>;
```

Use whichever icon name is available in the sidebar's icon set for "chart-bar" or "trending-up" — check existing icon cases in the sidebar file and pick the closest match.

**Step 3: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: add STRATEGY sidebar section with Requirements and Strategic Plan"
```

---

## Task 11: Lock Requirements editing to super admin

**Files:**

- Modify: `app/requirements/page.tsx`

**Step 1: Find the edit mode button and Add Requirement controls**

In `app/requirements/page.tsx`, the "Edit Requirements" button is rendered unconditionally. Gate it behind the super admin role.

**Step 2: Add role check**

Add `useRole()` import and hook at the top of the component, then gate the edit button:

```typescript
// Add import
import { useRole } from '@/lib/use-role';

// Add inside component
const { role } = useRole();
const isSuperAdmin = role === 'super_admin';
```

Then change the Edit Requirements button to only render if `isSuperAdmin`:

```tsx
{
  isSuperAdmin && (
    <Button
      variant={editMode ? 'primary' : 'ghost'}
      size="sm"
      onClick={() => {
        setEditMode(!editMode);
        setEditingReq(null);
        setDeleteConfirm(null);
        setAddingToGroup(null);
      }}
    >
      {editMode ? 'Done Editing' : 'Edit Requirements'}
    </Button>
  );
}
```

**Step 3: Commit**

```bash
git add app/requirements/page.tsx
git commit -m "feat: lock Requirements editing to super admin"
```

---

## Task 12: Help content update

**Files:**

- Modify: `lib/help-content.ts`

**Step 1: Add a Strategic Plan section to helpSections**

Add after the "Key vs. Support Processes" section:

```typescript
{
  title: "Strategic Plan & Balanced Scorecard",
  icon: "shield-check",
  questions: [
    {
      question: "What is the Strategic Plan page?",
      answer: "The Strategic Plan page shows NIA's FY26 Balanced Scorecard — 10 strategic objectives organized into four perspectives: Financial Stability, Organizational Capacity, Internal Processes, and Customer Satisfaction. It tracks live progress using existing Hub metrics and auto-computed data.",
      linkTo: "/strategy",
    },
    {
      question: "How is progress tracked for each objective?",
      answer: "Objectives use one of three methods: (1) Metric — pulls the latest value from a linked Hub metric automatically (e.g. Studer satisfaction scores update when survey data is entered); (2) ADLI Threshold — auto-counts processes that have achieved an ADLI score of 70 or higher; (3) Manual — an admin enters progress directly for goals without a linked metric (e.g. budget surplus).",
    },
    {
      question: "What do the green, yellow, and red dots mean?",
      answer: "Green means the objective is at or above its target. Yellow means it's within 10% below target — close but not there yet. Red means it's more than 10% below target and needs attention. Gray means no data is available yet.",
    },
    {
      question: "How do I link my process to a strategic objective?",
      answer: "On any process detail page, scroll to the Strategic Objectives section in the Overview tab. Check the box next to each objective your process supports. This helps NIA see which processes are driving strategic goals and shows coverage gaps.",
      linkTo: "/processes",
    },
    {
      question: "What is the ADLI ≥ 70 objective?",
      answer: "One of NIA's FY26 strategic goals is to have 20 or more processes achieve an ADLI overall score of 70 or higher by June 2026. This score is auto-computed — every time an AI assessment runs on a process, the count updates automatically. A score of 70 means a process has a systematic approach that is well-deployed and shows evidence of learning cycles.",
    },
  ],
},
```

**Step 2: Commit**

```bash
git add lib/help-content.ts
git commit -m "feat: add Strategic Plan help section"
```

---

## Task 13: Open PR and merge

**Step 1: Push branch**

```bash
git push -u origin jon/strategic-plan-scorecard
```

**Step 2: Create PR**

```bash
gh pr create --title "Strategic Plan & Balanced Scorecard (Baldrige Category 2)" \
  --body "Adds /strategy page with live BSC dashboard, process-objective linkage, sidebar STRATEGY section, Requirements locked to super admin, and help content. Covers all 10 FY26 strategic goals with three compute types (metric, adli_threshold, manual)."
```

**Step 3: Merge**

```bash
gh pr merge --squash
```

---

## Execution Checklist

- [ ] Task 1: DB migration — tables + enums
- [ ] Task 2: Seed migration — 10 FY26 goals
- [ ] Task 3: TypeScript types
- [ ] Task 4: GET /api/strategy
- [ ] Task 5: POST/PATCH/DELETE /api/strategy
- [ ] Task 6: Process-objective link route
- [ ] Task 7: /strategy page — Scorecard tab
- [ ] Task 8: /strategy page — Objectives tab
- [ ] Task 9: Process page — Strategic Objectives section
- [ ] Task 10: Sidebar restructuring
- [ ] Task 11: Lock Requirements to super admin
- [ ] Task 12: Help content
- [ ] Task 13: PR and merge
