// app/api/strategy/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import type { BscPerspective, ObjectiveStatus, StrategicObjectiveWithStatus } from "@/lib/types";

function computeStatus(current: number | null, target: number | null): ObjectiveStatus {
  if (current === null || target === null) return "no-data";
  if (current >= target) return "green";
  if (current >= target * 0.9) return "yellow";
  return "red";
}

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all objectives
  const { data: objectives, error } = await supabase
    .from("strategic_objectives")
    .select("*")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch linked process counts
  const { data: procLinks } = await supabase
    .from("process_objectives")
    .select("objective_id");
  const procCountByObjective = new Map<number, number>();
  for (const link of procLinks ?? []) {
    procCountByObjective.set(link.objective_id, (procCountByObjective.get(link.objective_id) ?? 0) + 1);
  }

  // For metric-type objectives: fetch all entries (ascending by date for trend)
  const metricIds = (objectives ?? [])
    .filter((o) => o.compute_type === "metric" && o.linked_metric_id)
    .map((o) => o.linked_metric_id as number);

  const { data: entries } = metricIds.length > 0
    ? await supabase
        .from("entries")
        .select("metric_id, value, date")
        .in("metric_id", metricIds)
        .order("date", { ascending: true })
    : { data: [] };

  // Build latest value + trend per metric
  const latestByMetric = new Map<number, number>();
  const valuesByMetric = new Map<number, number[]>();
  for (const e of entries ?? []) {
    latestByMetric.set(e.metric_id, e.value);
    if (!valuesByMetric.has(e.metric_id)) valuesByMetric.set(e.metric_id, []);
    valuesByMetric.get(e.metric_id)!.push(e.value);
  }

  // For adli_threshold objectives: count processes with latest ADLI score >= 70
  const { data: adliRows } = await supabase
    .from("process_adli_scores")
    .select("process_id, overall_score, assessed_at")
    .order("assessed_at", { ascending: false });

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

    if (obj.compute_type === "metric" && obj.linked_metric_id) {
      computed_value = latestByMetric.get(obj.linked_metric_id) ?? null;
      trend_direction = getTrend(valuesByMetric.get(obj.linked_metric_id) ?? []);
    } else if (obj.compute_type === "adli_threshold") {
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

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("auth_id", user.id).single();
  if (roleRow?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabase.from("strategic_objectives").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
