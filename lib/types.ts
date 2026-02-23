// Database types matching our Supabase schema

export interface Category {
  id: number;
  name: string;
  display_name: string;
  sort_order: number;
}

// Process classification: key (creates value) vs support (enables key processes)
export type ProcessType = "key" | "support" | "unclassified";

// Status workflow: draft → ready_for_review → approved
export type ProcessStatus =
  | "draft"
  | "ready_for_review"
  | "approved";

// JSONB field types for structured process data
// Each type has an optional `content` field that stores the full markdown
// of that section (preserved during Obsidian import so nothing is lost).

export interface Charter {
  content?: string;
  purpose?: string;
  scope_includes?: string;
  scope_excludes?: string;
  stakeholders?: string[];
  mission_alignment?: string;
}

export interface AdliApproach {
  content?: string;
  evidence_base?: string;
  key_steps?: string[];
  tools_used?: string[];
  key_requirements?: string;
}

export interface AdliDeployment {
  content?: string;
  teams?: string[];
  communication_plan?: string;
  training_approach?: string;
  consistency_mechanisms?: string;
}

export interface AdliLearning {
  content?: string;
  metrics?: string[];
  evaluation_methods?: string;
  review_frequency?: string;
  improvement_process?: string;
}

export interface AdliIntegration {
  content?: string;
  strategic_goals?: string[];
  mission_connection?: string;
  related_processes?: string[];
  standards_alignment?: string;
}

export interface Workflow {
  content?: string;
  flow_data?: import("./flow-types").ProcessMapFlowData;
  inputs?: string[];
  steps?: {
    responsible: string;
    action: string;
    output: string;
    timing: string;
  }[];
  outputs?: string[];
  quality_controls?: string[];
}

export interface Process {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  baldrige_item: string | null;
  status: ProcessStatus;
  owner: string | null;
  reviewer: string | null;
  charter: Charter | null;
  adli_approach: AdliApproach | null;
  adli_deployment: AdliDeployment | null;
  adli_learning: AdliLearning | null;
  adli_integration: AdliIntegration | null;
  workflow: Workflow | null;
  process_type: ProcessType;
  asana_raw_data: Record<string, unknown> | null;
  asana_raw_data_previous: Record<string, unknown> | null;
  asana_adli_task_gids: Record<string, string> | null;
  guided_step: string | null;
  updated_at: string;
}

export interface ProcessRequirement {
  id: number;
  process_id: number;
  requirement_id: number;
}

export interface ProcessHistory {
  id: number;
  process_id: number;
  version: string | null;
  change_description: string;
  changed_at: string;
}

export type ImprovementSection = "approach" | "deployment" | "learning" | "integration" | "charter" | "workflow";
export type ImprovementChangeType = "addition" | "modification" | "removal";
export type ImprovementStatus = "committed" | "in_progress" | "implemented" | "deferred" | "cancelled";
export type ImprovementSource = "ai_suggestion" | "user_initiated" | "review_finding" | "import";

export interface ProcessImprovement {
  id: number;
  process_id: number;
  section_affected: ImprovementSection;
  change_type: ImprovementChangeType;
  title: string;
  description: string | null;
  trigger: ImprovementSource | null;
  trigger_detail: string | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  status: ImprovementStatus;
  committed_by: string | null;
  committed_date: string;
  implemented_date: string | null;
  impact_assessed: boolean;
  impact_assessment_date: string | null;
  impact_notes: string | null;
  source: ImprovementSource;
  created_at: string;
}

export interface MetricProcess {
  id: number;
  metric_id: number;
  process_id: number;
}

export interface Metric {
  id: number;
  name: string;
  description: string | null;
  cadence: "monthly" | "quarterly" | "semi-annual" | "annual";
  target_value: number | null;
  comparison_value: number | null;
  comparison_source: string | null;
  data_source: string | null;
  collection_method: string | null;
  unit: string;
  is_higher_better: boolean;
  next_entry_expected: string | null;
}

export interface Entry {
  id: number;
  metric_id: number;
  value: number;
  date: string;
  note_analysis: string | null;
  note_course_correction: string | null;
  created_at: string;
}

export interface KeyRequirement {
  id: number;
  stakeholder_segment: string;
  stakeholder_group: string;
  requirement: string;
  description: string | null;
  sort_order: number;
}

export interface MetricRequirement {
  id: number;
  metric_id: number;
  requirement_id: number;
}

// ── PDCA Task types ──────────────────────────────────────────

export type PdcaSection = "plan" | "execute" | "evaluate" | "improve";
export type AdliDimension = "approach" | "deployment" | "learning" | "integration";
export type TaskSource = "ai_suggestion" | "ai_interview" | "user_created";
export type TaskStatus = "pending" | "active" | "completed" | "exported";
export type TaskOrigin = "asana" | "hub_ai" | "hub_manual";
export type TaskPriority = "high" | "medium" | "low";

export interface ProcessTask {
  id: number;
  process_id: number;
  title: string;
  description: string | null;
  pdca_section: PdcaSection;
  adli_dimension: AdliDimension | null;
  source: TaskSource;
  source_detail: string | null;
  status: TaskStatus;
  origin: TaskOrigin;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_asana_gid: string | null;
  start_date: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  asana_section_name: string | null;
  asana_section_gid: string | null;
  parent_asana_gid: string | null;
  is_subtask: boolean;
  last_synced_at: string | null;
  priority: TaskPriority;
  asana_task_gid: string | null;
  asana_task_url: string | null;
  sort_order: number;
  recurrence_rule: RecurrenceRule | null;
  recurring_parent_id: number | null;
  created_at: string;
}

// ── Recurrence rules ────────────────────────────────────────

export interface RecurrenceRule {
  type: "daily" | "weekly" | "monthly";
  interval: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  endDate?: string;
}

// ── Task attachments ────────────────────────────────────────

export interface TaskAttachment {
  id: number;
  task_id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  url?: string; // signed download URL (added by GET response)
}

// ── Task comments & activity ─────────────────────────────────

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: string;
  user_name: string;
  body: string;
  created_at: string;
}

export type TaskActivityAction =
  | "created"
  | "completed"
  | "uncompleted"
  | "deleted"
  | "reassigned"
  | "priority_changed"
  | "status_changed"
  | "commented"
  | "dependency_added"
  | "dependency_removed"
  | "attachment_added"
  | "attachment_removed"
  | "recurrence_set";

// ── Task dependencies ────────────────────────────────────────

export interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  created_at: string;
  created_by: string;
}

export interface TaskDependencyWithTitle extends TaskDependency {
  title: string;
  completed: boolean;
}

export interface TaskActivity {
  id: number;
  task_id: number;
  user_id: string;
  user_name: string;
  action: TaskActivityAction;
  detail: Record<string, unknown> | null;
  created_at: string;
}

// ── Notification preferences ─────────────────────────────────

export interface NotificationPreferences {
  notify_on_assignment: boolean;
  notify_on_due_approaching: boolean;
  notify_on_completion: boolean;
  notify_on_mention: boolean;
  notify_weekly_digest: boolean;
}

// ── Task mentions ────────────────────────────────────────────

export interface TaskMention {
  id: number;
  comment_id: number;
  task_id: number;
  mentioned_user_id: string;
  mentioned_user_name: string;
  created_at: string;
}

// Extended types for UI (joins data from multiple tables)

export interface KeyRequirementWithStatus extends KeyRequirement {
  linked_metrics: {
    id: number;
    name: string;
    latest_value: number | null;
    target_value: number | null;
    is_higher_better: boolean;
    trend_direction: "improving" | "declining" | "flat" | "insufficient";
    on_target: boolean | null; // null = no target set
  }[];
  health: "green" | "yellow" | "red" | "no-data";
}

export interface MetricWithStatus extends Metric {
  process_name: string;
  category_name: string;
  category_display_name: string;
  last_entry_date: string | null;
  last_entry_value: number | null;
  entry_count: number;
  review_status: "current" | "due-soon" | "overdue" | "no-data" | "scheduled";
}

export interface ProcessWithMetrics extends Process {
  category_display_name: string;
  metrics: MetricWithStatus[];
  metrics_with_data: number;
  total_metrics: number;
}

export interface CategoryWithProcesses extends Category {
  processes: ProcessWithMetrics[];
}
