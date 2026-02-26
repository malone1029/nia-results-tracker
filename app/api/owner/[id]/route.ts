// app/api/owner/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole } from "@/lib/auth-helpers";
import { computeCompliance } from "@/lib/compliance";
import { getReviewStatus } from "@/lib/review-status";
import { calculateHealthScore, type HealthProcessInput, type HealthMetricInput, type HealthTaskInput } from "@/lib/process-health";

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

  // Fetch processes owned by this user — match on owner_email (reliable) with
  // fallback to display name match for any processes not yet migrated
  const ownerEmail = owner.email?.toLowerCase();
  const ownerName = owner.full_name ?? owner.email;
  const { data: byEmail } = ownerEmail
    ? await supabase
        .from("processes")
        .select(`
          id, name, status, updated_at, process_type,
          adli_approach, adli_deployment, adli_learning, adli_integration,
          charter, workflow, asana_project_gid, asana_adli_task_gids
        `)
        .eq("owner_email", ownerEmail)
    : { data: [] };

  const { data: byName } = await supabase
    .from("processes")
    .select(`
      id, name, status, updated_at, process_type,
      adli_approach, adli_deployment, adli_learning, adli_integration,
      charter, workflow, asana_project_gid, asana_adli_task_gids
    `)
    .eq("owner", ownerName)
    .is("owner_email", null);

  // Merge: email-matched processes take precedence, add any name-only fallbacks
  const emailIds = new Set((byEmail ?? []).map((p) => p.id));
  const processes = [
    ...(byEmail ?? []),
    ...(byName ?? []).filter((p) => !emailIds.has(p.id)),
  ];

  const processIds = (processes ?? []).map((p) => p.id);

  // Fetch metrics for these processes (via metric_processes junction)
  const { data: metricLinks } = processIds.length > 0
    ? await supabase
        .from("metric_processes")
        .select("process_id, metrics(id, name, cadence, next_entry_expected, comparison_value)")
        .in("process_id", processIds)
    : { data: [] };

  // Fetch latest entry date per metric
  const metricIds = (metricLinks ?? [])
    .flatMap((ml) => {
      if (!ml.metrics) return [];
      return Array.isArray(ml.metrics) ? (ml.metrics as { id: number }[]) : [(ml.metrics as { id: number })];
    })
    .map((m) => m.id);

  const { data: latestEntries } = metricIds.length > 0
    ? await supabase
        .from("entries")
        .select("metric_id, date")
        .in("metric_id", metricIds)
        .order("date", { ascending: false })
    : { data: [] };

  // Build a map: metric_id -> latest date (and entry count for health scoring)
  const latestByMetric = new Map<number, string>();
  const entryCountByMetric = new Map<number, number>();
  for (const e of latestEntries ?? []) {
    if (!latestByMetric.has(e.metric_id)) {
      latestByMetric.set(e.metric_id, e.date);
    }
    entryCountByMetric.set(e.metric_id, (entryCountByMetric.get(e.metric_id) ?? 0) + 1);
  }

  // Fetch tasks, improvement journal, and Baldrige mappings for real health score computation
  const [
    { data: taskRows },
    { data: improvementRows },
    { data: baldrigeMappingRows },
  ] = await Promise.all([
    processIds.length > 0
      ? supabase.from("process_tasks").select("process_id, status, assignee_name, due_date, completed").in("process_id", processIds)
      : { data: [] as { process_id: number; status: string; assignee_name: string | null; due_date: string | null; completed: boolean }[] },
    processIds.length > 0
      ? supabase.from("improvement_journal").select("process_id, created_at").in("process_id", processIds).order("created_at", { ascending: false })
      : { data: [] as { process_id: number; created_at: string }[] },
    processIds.length > 0
      ? supabase.from("process_question_mappings").select("process_id").in("process_id", processIds)
      : { data: [] as { process_id: number }[] },
  ]);

  // Build task health inputs per process
  const tasksByProcess = new Map<number, HealthTaskInput>();
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const t of taskRows ?? []) {
    const existing = tasksByProcess.get(t.process_id) ?? { pending_count: 0, exported_count: 0, total_active_tasks: 0, completed_count: 0, tasks_with_assignee: 0, tasks_with_due_date: 0, overdue_count: 0 };
    if (t.status === "pending") {
      existing.pending_count++;
    } else {
      existing.exported_count++;
      existing.total_active_tasks++;
      if (t.completed) existing.completed_count++;
      if (t.assignee_name) existing.tasks_with_assignee++;
      if (t.due_date) {
        existing.tasks_with_due_date++;
        if (!t.completed && t.due_date < todayStr) existing.overdue_count++;
      }
    }
    tasksByProcess.set(t.process_id, existing);
  }

  // Build latest improvement journal date per process
  const latestImprovementByProcess = new Map<number, string>();
  for (const imp of improvementRows ?? []) {
    if (!latestImprovementByProcess.has(imp.process_id)) {
      latestImprovementByProcess.set(imp.process_id, imp.created_at);
    }
  }

  // Build Baldrige mapping counts per process
  const baldrigeMappingCounts = new Map<number, number>();
  for (const m of baldrigeMappingRows ?? []) {
    baldrigeMappingCounts.set(m.process_id, (baldrigeMappingCounts.get(m.process_id) ?? 0) + 1);
  }

  // Fetch metrics stewarded by this user (data_steward_email)
  const { data: stewardedMetrics } = ownerEmail
    ? await supabase
        .from("metrics")
        .select(`
          id, name, cadence, data_source, unit, next_entry_expected,
          entries (value, date)
        `)
        .eq("data_steward_email", ownerEmail)
        .order("name")
    : { data: [] };

  // Fetch ADLI scores per process (ordered newest first; column is assessed_at)
  const { data: adliScores } = processIds.length > 0
    ? await supabase
        .from("process_adli_scores")
        .select("process_id, overall_score, approach_score, deployment_score, learning_score, integration_score, assessed_at")
        .in("process_id", processIds)
        .order("assessed_at", { ascending: false })
    : { data: [] };

  // Latest ADLI score per process (for processes list in response)
  const latestAdliByProcess = new Map<number, number>();
  // Full ADLI history per process (newest first, for compliance)
  const adliHistoryByProcess = new Map<number, { score: number; scoredAt: string }[]>();
  // Latest dimension scores per process (for compliance)
  const adliDimensionsByProcess = new Map<number, {
    approach: number; deployment: number; learning: number; integration: number;
  }>();

  for (const s of adliScores ?? []) {
    if (!latestAdliByProcess.has(s.process_id)) {
      latestAdliByProcess.set(s.process_id, s.overall_score);
      adliDimensionsByProcess.set(s.process_id, {
        approach: s.approach_score ?? 0,
        deployment: s.deployment_score ?? 0,
        learning: s.learning_score ?? 0,
        integration: s.integration_score ?? 0,
      });
    }
    if (!adliHistoryByProcess.has(s.process_id)) {
      adliHistoryByProcess.set(s.process_id, []);
    }
    adliHistoryByProcess.get(s.process_id)!.push({
      score: s.overall_score,
      scoredAt: s.assessed_at,
    });
  }

  // Compute real health scores for each owned process using calculateHealthScore()
  // These are the same scores shown in the UI (5-dimension formula: doc/maturity/measurement/ops/freshness).
  const processHealthScores: number[] = (processes ?? []).map((p) => {
    const scoreInput = latestAdliByProcess.has(p.id)
      ? { overall_score: latestAdliByProcess.get(p.id)! }
      : null;

    const pMetricLinks = (metricLinks ?? [])
      .filter((ml) => ml.process_id === p.id)
      .flatMap((ml) => {
        if (!ml.metrics) return [];
        return Array.isArray(ml.metrics) ? ml.metrics : [ml.metrics];
      }) as { id: number; cadence: string; comparison_value: number | null }[];

    const healthMetricInputs: HealthMetricInput[] = pMetricLinks.map((m) => {
      const latestDate = latestByMetric.get(m.id) ?? null;
      const entryCount = entryCountByMetric.get(m.id) ?? 0;
      let letci = 0;
      if (entryCount >= 1) letci++;
      if (entryCount >= 3) letci++;
      if (m.comparison_value !== null && m.comparison_value !== undefined) letci++;
      letci++; // integration = linked to process
      return {
        has_recent_data: latestDate ? getReviewStatus(m.cadence, latestDate) === "current" : false,
        has_comparison: m.comparison_value !== null && m.comparison_value !== undefined,
        letci_score: letci,
        entry_count: entryCount,
      };
    });

    const taskInput: HealthTaskInput = tasksByProcess.get(p.id) ?? {
      pending_count: 0, exported_count: 0, total_active_tasks: 0,
      completed_count: 0, tasks_with_assignee: 0, tasks_with_due_date: 0, overdue_count: 0,
    };

    const processInput: HealthProcessInput = {
      id: p.id,
      charter: p.charter as Record<string, unknown> | null,
      adli_approach: p.adli_approach as Record<string, unknown> | null,
      adli_deployment: p.adli_deployment as Record<string, unknown> | null,
      adli_learning: p.adli_learning as Record<string, unknown> | null,
      adli_integration: p.adli_integration as Record<string, unknown> | null,
      workflow: p.workflow as Record<string, unknown> | null,
      baldrige_mapping_count: baldrigeMappingCounts.get(p.id) ?? 0,
      status: p.status,
      asana_project_gid: p.asana_project_gid ?? null,
      asana_adli_task_gids: p.asana_adli_task_gids as Record<string, string> | null,
      updated_at: p.updated_at,
    };

    return calculateHealthScore(
      processInput,
      scoreInput,
      healthMetricInputs,
      taskInput,
      { latest_date: latestImprovementByProcess.get(p.id) ?? null },
    ).total;
  });

  // Count improvement journal entries this calendar year (from already-fetched improvementRows)
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const improvementCount = (improvementRows ?? []).filter(
    (r) => r.created_at >= yearStart
  ).length;

  // Average ADLI score across ALL owned processes — unassessed processes count as 0.
  // This is the Option B roll-up: owners must assess their full portfolio, not just one process.
  const avgAdliScore = processIds.length > 0
    ? Math.round(
        processIds.reduce((sum, id) => sum + (latestAdliByProcess.get(id) ?? 0), 0) / processIds.length
      )
    : 0;

  // Build compliance input
  const processesForCompliance = (processes ?? []).map((p) => {
    const pMetrics = (metricLinks ?? [])
      .filter((ml) => ml.process_id === p.id)
      .flatMap((ml) => {
        if (!ml.metrics) return [];
        const arr = Array.isArray(ml.metrics) ? ml.metrics : [ml.metrics];
        return arr as { id: number; name: string; cadence: string; next_entry_expected: string | null }[];
      });

    return {
      metrics: pMetrics.map((m) => ({
        cadence: m.cadence,
        lastEntryDate: latestByMetric.get(m.id) ?? null,
        nextEntryExpected: m.next_entry_expected ?? null,
      })),
    };
  });

  const compliance = computeCompliance({
    onboardingCompletedAt: owner.onboarding_completed_at,
    processHealthScores,
    avgAdliScore,
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
    stewardedMetrics: (stewardedMetrics || []).map((m) => {
      const entries = (m.entries as { value: number; date: string }[] | null) ?? [];
      const latestEntry = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return {
        id: m.id,
        name: m.name,
        cadence: m.cadence,
        data_source: m.data_source,
        review_status: getReviewStatus(
          m.cadence,
          latestEntry?.date ?? null,
          m.next_entry_expected
        ),
      };
    }),
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

  if (error) return NextResponse.json({ error: "Failed to update onboarding status" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
