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

  const { data: users } = await supabase
    .from("user_roles")
    .select("auth_id, email, full_name, role, last_login_at, onboarding_completed_at")
    .order("full_name");

  if (!users) return NextResponse.json({ scorecards: [] });

  const { data: allProcesses } = await supabase
    .from("processes")
    .select("id, name, status, updated_at, owner");

  const processIds = (allProcesses ?? []).map((p) => p.id);

  const { data: metricLinks } = processIds.length > 0
    ? await supabase
        .from("metric_processes")
        .select("process_id, metrics(id, cadence)")
        .in("process_id", processIds)
    : { data: [] };

  const metricIds = (metricLinks ?? [])
    .flatMap((ml) => {
      if (!ml.metrics) return [];
      const arr = Array.isArray(ml.metrics) ? ml.metrics : [ml.metrics];
      return arr as { id: number; cadence: string }[];
    })
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

  const scorecards = users.map((u) => {
    const ownerName = u.full_name ?? u.email;
    const userProcesses = (allProcesses ?? []).filter((p) => p.owner === ownerName);
    const userProcessIds = new Set(userProcesses.map((p) => p.id));

    const processesForCompliance = userProcesses.map((p) => {
      const pMetrics = (metricLinks ?? [])
        .filter((ml) => ml.process_id === p.id)
        .flatMap((ml) => {
          if (!ml.metrics) return [];
          const arr = Array.isArray(ml.metrics) ? ml.metrics : [ml.metrics];
          return arr as { id: number; cadence: string }[];
        });

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

    return { ...u, processCount: userProcesses.length, compliance };
  });

  scorecards.sort((a, b) => {
    if (a.compliance.isCompliant !== b.compliance.isCompliant) {
      return a.compliance.isCompliant ? 1 : -1;
    }
    return (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email);
  });

  return NextResponse.json({ scorecards });
}
