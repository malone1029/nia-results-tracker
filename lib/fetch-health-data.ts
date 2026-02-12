// Shared helper that fetches all process data + computes health scores.
// Used by both /processes and /readiness pages to avoid duplicating ~120 lines
// of parallel Supabase queries and Map-building logic.

import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateHealthScore,
  type HealthResult,
  type HealthProcessInput,
  type HealthScoreInput,
  type HealthMetricInput,
  type HealthTaskInput,
  type HealthImprovementInput,
} from "@/lib/process-health";
import { getReviewStatus } from "@/lib/review-status";
import type { ProcessStatus, ProcessType } from "@/lib/types";

export interface ProcessWithCategory {
  id: number;
  name: string;
  category_id: number;
  category_display_name: string;
  is_key: boolean;
  process_type: ProcessType;
  status: ProcessStatus;
  owner: string | null;
  baldrige_item: string | null;
  charter: Record<string, unknown> | null;
  adli_approach: Record<string, unknown> | null;
  adli_deployment: Record<string, unknown> | null;
  adli_learning: Record<string, unknown> | null;
  adli_integration: Record<string, unknown> | null;
  workflow: Record<string, unknown> | null;
  baldrige_connections: Record<string, unknown> | null;
  asana_project_gid: string | null;
  asana_adli_task_gids: Record<string, string> | null;
  updated_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  display_name: string;
  sort_order: number;
}

export interface HealthData {
  processes: ProcessWithCategory[];
  categories: CategoryRow[];
  healthScores: Map<number, HealthResult>;
  lastActivityMap: Map<number, string>; // process id → most recent ISO date
}

export async function fetchHealthData(client?: SupabaseClient): Promise<HealthData> {
  const db = client ?? supabase;
  // Fetch all 8 tables in parallel
  const [
    { data: catData },
    { data: procData },
    { data: scoresData },
    { data: metricLinks },
    { data: allMetrics },
    { data: allEntries },
    { data: tasksData },
    { data: improvementsData },
  ] = await Promise.all([
    db.from("categories").select("*").order("sort_order"),
    db.from("processes").select(`
      id, name, category_id, is_key, process_type, status, owner, baldrige_item,
      charter, adli_approach, adli_deployment, adli_learning, adli_integration,
      workflow, baldrige_connections,
      asana_project_gid, asana_adli_task_gids, updated_at,
      categories!inner ( display_name )
    `).order("name"),
    db.from("process_adli_scores").select("process_id, overall_score"),
    db.from("metric_processes").select("process_id, metric_id"),
    db.from("metrics").select("id, cadence, comparison_value"),
    db.from("entries").select("metric_id, date").order("date", { ascending: false }),
    db.from("process_tasks").select("process_id, status"),
    db.from("process_improvements").select("process_id, committed_date").order("committed_date", { ascending: false }),
  ]);

  // Fetch Baldrige mapping counts per process (for health scoring)
  const { data: mappingData } = await db
    .from("process_question_mappings")
    .select("process_id");
  const baldrigeMappingCounts = new Map<number, number>();
  for (const m of mappingData || []) {
    baldrigeMappingCounts.set(m.process_id, (baldrigeMappingCounts.get(m.process_id) || 0) + 1);
  }

  const processes: ProcessWithCategory[] = (procData || []).map(
    (p: Record<string, unknown>) => {
      const cat = p.categories as Record<string, unknown>;
      return {
        id: p.id as number,
        name: p.name as string,
        category_id: p.category_id as number,
        category_display_name: cat.display_name as string,
        is_key: p.is_key as boolean,
        process_type: (p.process_type as ProcessType) || "unclassified",
        status: (p.status as ProcessStatus) || "draft",
        owner: p.owner as string | null,
        baldrige_item: p.baldrige_item as string | null,
        charter: p.charter as Record<string, unknown> | null,
        adli_approach: p.adli_approach as Record<string, unknown> | null,
        adli_deployment: p.adli_deployment as Record<string, unknown> | null,
        adli_learning: p.adli_learning as Record<string, unknown> | null,
        adli_integration: p.adli_integration as Record<string, unknown> | null,
        workflow: p.workflow as Record<string, unknown> | null,
        baldrige_connections: p.baldrige_connections as Record<string, unknown> | null,
        asana_project_gid: p.asana_project_gid as string | null,
        asana_adli_task_gids: p.asana_adli_task_gids as Record<string, string> | null,
        updated_at: p.updated_at as string,
      };
    }
  );

  // Build lookup maps for health score inputs
  const scoresByProcess = new Map<number, HealthScoreInput>();
  for (const s of scoresData || []) {
    scoresByProcess.set(s.process_id, { overall_score: s.overall_score });
  }

  // Build metric data per process
  const metricsByProcess = new Map<number, number[]>();
  for (const link of metricLinks || []) {
    const existing = metricsByProcess.get(link.process_id) || [];
    existing.push(link.metric_id);
    metricsByProcess.set(link.process_id, existing);
  }

  const metricsById = new Map<number, { cadence: string; comparison_value: number | null }>();
  for (const m of allMetrics || []) {
    metricsById.set(m.id, { cadence: m.cadence, comparison_value: m.comparison_value });
  }

  // Latest entry date per metric
  const latestEntryByMetric = new Map<number, string>();
  const entryCountByMetric = new Map<number, number>();
  for (const e of allEntries || []) {
    if (!latestEntryByMetric.has(e.metric_id)) {
      latestEntryByMetric.set(e.metric_id, e.date);
    }
    entryCountByMetric.set(e.metric_id, (entryCountByMetric.get(e.metric_id) || 0) + 1);
  }

  // Tasks per process
  const tasksByProcess = new Map<number, HealthTaskInput>();
  for (const t of tasksData || []) {
    const existing = tasksByProcess.get(t.process_id) || { pending_count: 0, exported_count: 0 };
    if (t.status === "pending") existing.pending_count++;
    else existing.exported_count++;
    tasksByProcess.set(t.process_id, existing);
  }

  // Latest improvement per process
  const improvementsByProcess = new Map<number, string>();
  for (const imp of improvementsData || []) {
    if (!improvementsByProcess.has(imp.process_id)) {
      improvementsByProcess.set(imp.process_id, imp.committed_date);
    }
  }

  // Calculate health scores for all processes
  const healthScores = new Map<number, HealthResult>();
  for (const proc of processes) {
    const processInput: HealthProcessInput = {
      ...proc,
      baldrige_mapping_count: baldrigeMappingCounts.get(proc.id) || 0,
    };
    const scoreInput = scoresByProcess.get(proc.id) || null;

    // Build metric health inputs
    const metricIds = metricsByProcess.get(proc.id) || [];
    const metricInputs: HealthMetricInput[] = metricIds.map((mid) => {
      const m = metricsById.get(mid);
      const latestDate = latestEntryByMetric.get(mid) || null;
      const entryCount = entryCountByMetric.get(mid) || 0;

      // LeTCI: 1 for level (has data), 1 for trend (3+ entries), 1 for comparison, 1 for integration
      let letci = 0;
      if (entryCount >= 1) letci++;
      if (entryCount >= 3) letci++;
      if (m?.comparison_value !== null && m?.comparison_value !== undefined) letci++;
      letci++; // integration = linked to process (always true here)

      return {
        has_recent_data: latestDate ? getReviewStatus(m?.cadence || "annual", latestDate) === "current" : false,
        has_comparison: m?.comparison_value !== null && m?.comparison_value !== undefined,
        letci_score: letci,
        entry_count: entryCount,
      };
    });

    const taskInput = tasksByProcess.get(proc.id) || { pending_count: 0, exported_count: 0 };
    const improvementInput: HealthImprovementInput = {
      latest_date: improvementsByProcess.get(proc.id) || null,
    };

    healthScores.set(proc.id, calculateHealthScore(processInput, scoreInput, metricInputs, taskInput, improvementInput));
  }

  // Compute last activity date per process
  // = most recent of: updated_at, latest improvement, latest entry on linked metrics
  const lastActivityMap = new Map<number, string>();
  for (const proc of processes) {
    let latest = proc.updated_at;
    const impDate = improvementsByProcess.get(proc.id);
    if (impDate && impDate > latest) latest = impDate;
    // Check entries for linked metrics
    const linkedMetricIds = metricsByProcess.get(proc.id) || [];
    for (const mid of linkedMetricIds) {
      const entryDate = latestEntryByMetric.get(mid);
      if (entryDate && entryDate > latest) latest = entryDate;
    }
    lastActivityMap.set(proc.id, latest);
  }

  const categories: CategoryRow[] = (catData || []).map(
    (c: Record<string, unknown>) => ({
      id: c.id as number,
      name: c.name as string,
      display_name: c.display_name as string,
      sort_order: c.sort_order as number,
    })
  );

  return { processes, categories, healthScores, lastActivityMap };
}
