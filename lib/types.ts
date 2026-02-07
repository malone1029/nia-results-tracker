// Database types matching our Supabase schema

export interface Category {
  id: number;
  name: string;
  display_name: string;
  sort_order: number;
}

// Status workflow: draft → ready_for_review → in_review → revisions_needed → approved
export type ProcessStatus =
  | "draft"
  | "ready_for_review"
  | "in_review"
  | "revisions_needed"
  | "approved";

export type TemplateType = "quick" | "full";

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

export interface BaldigeConnections {
  content?: string;
  questions_addressed?: string[];
  evidence_by_dimension?: {
    approach?: string;
    deployment?: string;
    learning?: string;
    integration?: string;
  };
}

export interface Process {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  baldrige_item: string | null;
  status: ProcessStatus;
  template_type: TemplateType;
  owner: string | null;
  reviewer: string | null;
  charter: Charter | null;
  basic_steps: string[] | null;
  participants: string[] | null;
  metrics_summary: string | null;
  connections: string | null;
  adli_approach: AdliApproach | null;
  adli_deployment: AdliDeployment | null;
  adli_learning: AdliLearning | null;
  adli_integration: AdliIntegration | null;
  workflow: Workflow | null;
  baldrige_connections: BaldigeConnections | null;
  is_key: boolean;
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

export interface Metric {
  id: number;
  process_id: number;
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
  review_status: "current" | "due-soon" | "overdue" | "no-data";
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
