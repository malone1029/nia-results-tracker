// Process Health Score Engine
// Calculates a 0-100 health score across 5 dimensions:
// Documentation (25), Maturity (20), Measurement (20), Operations (20), Freshness (15)

export interface HealthDimensionDetail {
  label: string;
  earned: number;
  possible: number;
}

export interface HealthDimension {
  score: number;
  max: number;
  details: HealthDimensionDetail[];
}

export interface HealthNextAction {
  label: string;
  href?: string; // optional link to the right page
  points: number; // how many points this would earn
}

export interface HealthLevel {
  label: string;
  color: string; // hex color
}

export interface HealthResult {
  total: number;
  level: HealthLevel;
  dimensions: {
    documentation: HealthDimension;
    maturity: HealthDimension;
    measurement: HealthDimension;
    operations: HealthDimension;
    freshness: HealthDimension;
  };
  nextActions: HealthNextAction[];
}

// Input types — these match what we can fetch from Supabase on list and detail pages

export interface HealthProcessInput {
  id: number;
  charter: Record<string, unknown> | null;
  adli_approach: Record<string, unknown> | null;
  adli_deployment: Record<string, unknown> | null;
  adli_learning: Record<string, unknown> | null;
  adli_integration: Record<string, unknown> | null;
  workflow: Record<string, unknown> | null;
  baldrige_mapping_count: number; // from process_question_mappings
  status: string;
  asana_project_gid: string | null;
  asana_adli_task_gids: Record<string, string> | null;
  updated_at: string;
}

export interface HealthScoreInput {
  overall_score: number | null; // 0-100, null if no assessment
}

export interface HealthMetricInput {
  has_recent_data: boolean; // within cadence
  has_comparison: boolean;
  letci_score: number; // 0-4
  entry_count: number;
}

export interface HealthTaskInput {
  pending_count: number;
  exported_count: number;
  // Enhanced task execution fields (Batch 6)
  total_active_tasks: number; // active + completed (excludes pending AI suggestions)
  completed_count: number;
  tasks_with_assignee: number;
  tasks_with_due_date: number;
  overdue_count: number;
}

export interface HealthImprovementInput {
  latest_date: string | null; // ISO date of most recent improvement
}

// Health levels
export function getHealthLevel(score: number): HealthLevel {
  if (score >= 80) return { label: "Baldrige Ready", color: "#b1bd37" };
  if (score >= 60) return { label: "On Track", color: "#55787c" };
  if (score >= 40) return { label: "Developing", color: "#f79935" };
  return { label: "Getting Started", color: "#dc2626" };
}

// Calculate days since a date
function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999; // Treat invalid dates as very stale
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// Check if a JSONB field has meaningful content (not just empty object)
function hasContent(field: Record<string, unknown> | null): boolean {
  if (!field) return false;
  // Check for 'content' key with non-empty string (the markdown narrative)
  if (typeof field.content === "string" && field.content.trim().length > 0) return true;
  // Fallback: check if any key has a non-null, non-empty value
  return Object.values(field).some(
    (v) => v !== null && v !== undefined && v !== "" && (typeof v !== "object" || (Array.isArray(v) && v.length > 0))
  );
}

export function calculateHealthScore(
  process: HealthProcessInput,
  scores: HealthScoreInput | null,
  metrics: HealthMetricInput[],
  tasks: HealthTaskInput,
  improvements: HealthImprovementInput
): HealthResult {
  // ── Documentation (0-25) ──────────────────────────────
  const docDetails: HealthDimensionDetail[] = [];
  const charterPts = hasContent(process.charter) ? 5 : 0;
  docDetails.push({ label: "Charter", earned: charterPts, possible: 5 });

  const adliFields = [
    { key: "adli_approach", label: "Approach" },
    { key: "adli_deployment", label: "Deployment" },
    { key: "adli_learning", label: "Learning" },
    { key: "adli_integration", label: "Integration" },
  ] as const;

  for (const f of adliFields) {
    const val = process[f.key] as Record<string, unknown> | null;
    const pts = hasContent(val) ? 4 : 0;
    docDetails.push({ label: f.label, earned: pts, possible: 4 });
  }

  const workflowPts = hasContent(process.workflow) ? 2 : 0;
  docDetails.push({ label: "Workflow", earned: workflowPts, possible: 2 });

  const baldrigePts = process.baldrige_mapping_count > 0 ? 2 : 0;
  docDetails.push({ label: "Baldrige Connections", earned: baldrigePts, possible: 2 });

  const docScore = docDetails.reduce((sum, d) => sum + d.earned, 0);

  // ── Maturity (0-20) ───────────────────────────────────
  const matDetails: HealthDimensionDetail[] = [];
  const overallScore = scores?.overall_score ?? null;
  const matPts = overallScore !== null ? Math.round(overallScore * 0.20) : 0;
  matDetails.push({
    label: overallScore !== null ? `ADLI Score: ${overallScore}%` : "No ADLI assessment",
    earned: matPts,
    possible: 20,
  });
  const matScore = matPts;

  // ── Measurement (0-20) ────────────────────────────────
  const measDetails: HealthDimensionDetail[] = [];
  const hasMetrics = metrics.length >= 1;
  const hasMany = metrics.length >= 3;
  const hasRecentData = metrics.some((m) => m.has_recent_data);
  const hasGoodLetci = metrics.some((m) => m.letci_score >= 3);
  const hasComparison = metrics.some((m) => m.has_comparison);

  measDetails.push({ label: "Has linked metrics", earned: hasMetrics ? 5 : 0, possible: 5 });
  measDetails.push({ label: "3+ linked metrics", earned: hasMany ? 3 : 0, possible: 3 });
  measDetails.push({ label: "Metrics have recent data", earned: hasRecentData ? 4 : 0, possible: 4 });
  measDetails.push({ label: "LeTCI score 3+", earned: hasGoodLetci ? 4 : 0, possible: 4 });
  measDetails.push({ label: "Comparison value set", earned: hasComparison ? 4 : 0, possible: 4 });

  const measScore = measDetails.reduce((sum, d) => sum + d.earned, 0);

  // ── Operations (0-20) ─────────────────────────────────
  const opsDetails: HealthDimensionDetail[] = [];
  const asanaLinked = !!process.asana_project_gid;
  const isApproved = process.status === "approved";

  opsDetails.push({ label: "Linked to Asana", earned: asanaLinked ? 3 : 0, possible: 3 });
  opsDetails.push({ label: "Status: Approved", earned: isApproved ? 2 : 0, possible: 2 });

  // Task execution quality (only scored when tasks exist)
  const totalActive = tasks.total_active_tasks;
  if (totalActive > 0) {
    // Tasks have assignees (0-4): proportion-based
    const assigneeRate = tasks.tasks_with_assignee / totalActive;
    const assigneePts = Math.round(assigneeRate * 4);
    opsDetails.push({
      label: `Tasks with assignees (${tasks.tasks_with_assignee}/${totalActive})`,
      earned: assigneePts,
      possible: 4,
    });

    // Tasks have due dates (0-4): proportion-based
    const dueDateRate = tasks.tasks_with_due_date / totalActive;
    const dueDatePts = Math.round(dueDateRate * 4);
    opsDetails.push({
      label: `Tasks with due dates (${tasks.tasks_with_due_date}/${totalActive})`,
      earned: dueDatePts,
      possible: 4,
    });

    // Completion rate (0-4): proportion-based
    const completionRate = tasks.completed_count / totalActive;
    const completionPts = Math.round(completionRate * 4);
    opsDetails.push({
      label: `Task completion (${tasks.completed_count}/${totalActive})`,
      earned: completionPts,
      possible: 4,
    });

    // No overdue tasks (0-3): full marks if zero overdue, partial if some
    let overduePts = 0;
    if (tasks.overdue_count === 0) {
      overduePts = 3;
    } else {
      const overdueRate = tasks.overdue_count / totalActive;
      overduePts = overdueRate < 0.25 ? 2 : overdueRate < 0.5 ? 1 : 0;
    }
    opsDetails.push({
      label: tasks.overdue_count === 0
        ? "No overdue tasks"
        : `${tasks.overdue_count} overdue task${tasks.overdue_count !== 1 ? "s" : ""}`,
      earned: overduePts,
      possible: 3,
    });
  } else {
    // No tasks yet — show what's possible
    opsDetails.push({ label: "Tasks with assignees", earned: 0, possible: 4 });
    opsDetails.push({ label: "Tasks with due dates", earned: 0, possible: 4 });
    opsDetails.push({ label: "Task completion", earned: 0, possible: 4 });
    opsDetails.push({ label: "No overdue tasks", earned: 0, possible: 3 });
  }

  const opsScore = opsDetails.reduce((sum, d) => sum + d.earned, 0);

  // ── Freshness (0-15) ──────────────────────────────────
  const freshDetails: HealthDimensionDetail[] = [];
  // Use the most recent date: updated_at or latest improvement
  let mostRecentDate = process.updated_at;
  if (improvements.latest_date && improvements.latest_date > mostRecentDate) {
    mostRecentDate = improvements.latest_date;
  }

  const days = daysSince(mostRecentDate);
  let freshPts = 0;
  let freshLabel = "";
  if (days <= 30) {
    freshPts = 15;
    freshLabel = `Updated ${days} day${days !== 1 ? "s" : ""} ago`;
  } else if (days <= 60) {
    freshPts = 10;
    freshLabel = `Updated ${days} days ago`;
  } else if (days <= 90) {
    freshPts = 5;
    freshLabel = `Updated ${days} days ago`;
  } else {
    freshPts = 0;
    freshLabel = `Updated ${days} days ago — needs attention`;
  }
  freshDetails.push({ label: freshLabel, earned: freshPts, possible: 15 });
  const freshScore = freshPts;

  // ── Total ─────────────────────────────────────────────
  const total = docScore + matScore + measScore + opsScore + freshScore;

  // ── Next Actions (pick top 3 by points potential) ─────
  const actions: HealthNextAction[] = [];
  const processId = process.id;

  // Documentation gaps — link to edit page with section hash
  if (charterPts === 0) {
    actions.push({ label: "Write a charter for this process", href: `/processes/${processId}/edit#charter`, points: 5 });
  }
  for (const f of adliFields) {
    const val = process[f.key] as Record<string, unknown> | null;
    if (!hasContent(val)) {
      actions.push({ label: `Write the ${f.label} section`, href: `/processes/${processId}/edit#${f.key}`, points: 4 });
    }
  }

  // Maturity — link to process with AI chat prompt
  if (overallScore === null) {
    actions.push({ label: "Run an AI assessment to get ADLI maturity scores", href: `/processes/${processId}?openAI=assessment`, points: 10 });
  } else if (overallScore < 50) {
    actions.push({ label: "Improve ADLI maturity through an AI deep dive", href: `/processes/${processId}?openAI=deep_dive`, points: 5 });
  }

  // Measurement
  if (!hasMetrics) {
    actions.push({ label: "Link at least one metric to this process", href: `/processes/${processId}?openAI=metrics`, points: 5 });
  }
  if (hasMetrics && !hasComparison) {
    actions.push({ label: "Add a comparison value to a linked metric", href: `/data-health`, points: 4 });
  }
  if (hasMetrics && !hasRecentData) {
    actions.push({ label: "Log recent data for linked metrics", href: "/log", points: 4 });
  }

  // Operations
  if (!asanaLinked) {
    actions.push({ label: "Link this process to an Asana project", href: `/processes/${processId}?openExport=true`, points: 3 });
  }
  if (totalActive > 0) {
    const unassigned = totalActive - tasks.tasks_with_assignee;
    if (unassigned > 0) {
      actions.push({ label: `Assign owners to ${unassigned} task${unassigned !== 1 ? "s" : ""}`, href: `/processes/${processId}`, points: 4 });
    }
    const noDueDate = totalActive - tasks.tasks_with_due_date;
    if (noDueDate > 0) {
      actions.push({ label: `Add due dates to ${noDueDate} task${noDueDate !== 1 ? "s" : ""}`, href: `/processes/${processId}`, points: 4 });
    }
    if (tasks.overdue_count > 0) {
      actions.push({ label: `Review ${tasks.overdue_count} overdue task${tasks.overdue_count !== 1 ? "s" : ""}`, href: `/processes/${processId}`, points: 3 });
    }
  }

  // Freshness — link to AI improvement cycle
  if (days > 60) {
    actions.push({ label: `Run an improvement cycle (last updated ${days} days ago)`, href: `/processes/${processId}?openAI=charter`, points: days > 90 ? 15 : 10 });
  }

  // Sort by points (highest first) and take top 3
  actions.sort((a, b) => b.points - a.points);
  const topActions = actions.slice(0, 3);

  return {
    total,
    level: getHealthLevel(total),
    dimensions: {
      documentation: { score: docScore, max: 25, details: docDetails },
      maturity: { score: matScore, max: 20, details: matDetails },
      measurement: { score: measScore, max: 20, details: measDetails },
      operations: { score: opsScore, max: 20, details: opsDetails },
      freshness: { score: freshScore, max: 15, details: freshDetails },
    },
    nextActions: topActions,
  };
}
