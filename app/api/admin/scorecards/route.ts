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
    .select("id, name, status, updated_at, owner, owner_email");

  const processIds = (allProcesses ?? []).map((p) => p.id);

  const { data: metricLinks } = processIds.length > 0
    ? await supabase
        .from("metric_processes")
        .select("process_id, metrics(id, cadence, next_entry_expected)")
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

  // Fetch ADLI scores for all processes (ordered newest first; column is assessed_at)
  const { data: adliScores } = processIds.length > 0
    ? await supabase
        .from("process_adli_scores")
        .select("process_id, overall_score, approach_score, deployment_score, learning_score, integration_score, assessed_at")
        .in("process_id", processIds)
        .order("assessed_at", { ascending: false })
    : { data: [] };

  // Build ADLI maps (newest first per process)
  const latestAdliByProcess = new Map<number, number>();
  const adliHistoryByProcess = new Map<number, { score: number; scoredAt: string }[]>();
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
    if (!adliHistoryByProcess.has(s.process_id)) adliHistoryByProcess.set(s.process_id, []);
    adliHistoryByProcess.get(s.process_id)!.push({ score: s.overall_score, scoredAt: s.assessed_at });
  }

  const scorecards = users.map((u) => {
    const ownerName = u.full_name ?? u.email;
    const userEmail = u.email?.toLowerCase();
    const userProcesses = (allProcesses ?? []).filter((p) =>
      userEmail && p.owner_email
        ? p.owner_email === userEmail
        : p.owner_email === null && p.owner === ownerName
    );

    // Health scores: use ADLI overall score (0–100) directly as a proxy.
    // Processes without an ADLI score contribute 0. At least one ≥ 60 passes the check.
    const userProcIds = userProcesses.map((p) => p.id);
    const processHealthScores = userProcIds.map((id) => latestAdliByProcess.get(id) ?? 0);

    const processesForCompliance = userProcesses.map((p) => {
      const pMetrics = (metricLinks ?? [])
        .filter((ml) => ml.process_id === p.id)
        .flatMap((ml) => {
          if (!ml.metrics) return [];
          const arr = Array.isArray(ml.metrics) ? ml.metrics : [ml.metrics];
          return arr as { id: number; cadence: string; next_entry_expected: string | null }[];
        });

      return {
        metrics: pMetrics.map((m) => ({
          cadence: m.cadence,
          lastEntryDate: latestByMetric.get(m.id) ?? null,
          nextEntryExpected: m.next_entry_expected ?? null,
        })),
        adliHistory: adliHistoryByProcess.get(p.id) ?? [],
        adliDimensions: adliDimensionsByProcess.get(p.id) ?? null,
      };
    });

    const compliance = computeCompliance({
      onboardingCompletedAt: u.onboarding_completed_at,
      processHealthScores,
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
