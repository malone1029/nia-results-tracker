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
          charter, workflow
        `)
        .eq("owner_email", ownerEmail)
    : { data: [] };

  const { data: byName } = await supabase
    .from("processes")
    .select(`
      id, name, status, updated_at, process_type,
      adli_approach, adli_deployment, adli_learning, adli_integration,
      charter, workflow
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
        .select("process_id, metrics(id, name, cadence, next_entry_expected)")
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
      .flatMap((ml) => {
        if (!ml.metrics) return [];
        const arr = Array.isArray(ml.metrics) ? ml.metrics : [ml.metrics];
        return arr as { id: number; name: string; cadence: string; next_entry_expected: string | null }[];
      });

    return {
      updated_at: p.updated_at,
      status: p.status,
      metrics: pMetrics.map((m) => ({
        cadence: m.cadence,
        lastEntryDate: latestByMetric.get(m.id) ?? null,
        nextEntryExpected: m.next_entry_expected ?? null,
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

  if (error) return NextResponse.json({ error: "Failed to update onboarding status" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
