// Database types matching our Supabase schema

export interface Category {
  id: number;
  name: string;
  display_name: string;
  sort_order: number;
}

export interface Process {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  baldrige_item: string | null;
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

// Extended types for UI (joins data from multiple tables)

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
