import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { fetchHealthData } from "@/lib/fetch-health-data";
import { getHealthLevel } from "@/lib/process-health";

export async function GET() {
  const supabase = await createSupabaseServer();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { processes, healthScores } = await fetchHealthData(supabase);

    if (processes.length === 0) {
      return NextResponse.json({
        score: 0,
        level: "Getting Started",
        color: "#dc2626",
        topAction: null,
        monthlyStreak: 0,
      });
    }

    // Weighted average: key processes count 2x
    let totalWeight = 0;
    let weightedSum = 0;
    const allActions: { label: string; href: string; points: number }[] = [];

    for (const proc of processes) {
      const health = healthScores.get(proc.id);
      if (!health) continue;
      const weight = proc.process_type === "key" ? 2 : 1;
      weightedSum += health.total * weight;
      totalWeight += weight;

      // Collect next actions from all processes
      for (const action of health.nextActions) {
        if (action.href) {
          allActions.push({
            label: action.label,
            href: action.href,
            points: action.points,
          });
        }
      }
    }

    const avgScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const level = getHealthLevel(avgScore);

    // Deduplicate and pick highest-points action
    const seen = new Set<string>();
    const uniqueActions: typeof allActions = [];
    // Sort highest-points first
    allActions.sort((a, b) => b.points - a.points);
    for (const action of allActions) {
      // Normalize label for dedup
      const key = action.label.replace(/for this process/gi, "").trim();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueActions.push(action);
      }
    }
    const topAction = uniqueActions[0] || null;

    // Monthly improvement count — query journal entries for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("improvement_journal")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart);

    return NextResponse.json({
      score: avgScore,
      level: level.label,
      color: level.color,
      topAction,
      monthlyStreak: count || 0,
    });
  } catch (err) {
    console.error("sidebar-health error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
