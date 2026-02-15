/**
 * Shared types for dashboard components.
 *
 * DashboardTask is a lightweight projection of ProcessTask — only the
 * fields the dashboard needs, plus the joined process_name.
 */

export interface DashboardTask {
  id: number;
  process_id: number;
  process_name: string;
  title: string;
  pdca_section: string;
  origin: string;
  assignee_name: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
}

export interface DashboardTaskStats {
  totalActive: number;
  totalCompleted: number;
  totalOverdue: number;
  completionRate: number; // 0-100
  unassignedCount: number;
}

export interface DashboardTaskData {
  overdue: DashboardTask[];
  upcoming: DashboardTask[];
  recentlyCompleted: DashboardTask[];
  stats: DashboardTaskStats;
}

export interface ActionItem {
  type: "overdue" | "due-soon";
  label: string;
  href: string;
  metricId?: number;
}

export interface ScoreRow {
  process_id: number;
  approach_score: number;
  deployment_score: number;
  learning_score: number;
  integration_score: number;
  overall_score: number;
  assessed_at: string;
}
