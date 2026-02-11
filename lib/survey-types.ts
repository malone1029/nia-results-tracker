// Shared types and constants for the survey module

export const QUESTION_TYPES = [
  { value: "rating", label: "Rating Scale", icon: "★" },
  { value: "yes_no", label: "Yes / No", icon: "✓" },
  { value: "nps", label: "Net Promoter Score", icon: "📊" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "○" },
  { value: "checkbox", label: "Checkbox", icon: "☐" },
  { value: "open_text", label: "Open Text", icon: "✎" },
  { value: "matrix", label: "Matrix / Grid", icon: "▦" },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

// Options stored in survey_questions.options JSONB — shape depends on question_type
export interface RatingOptions {
  labels?: string[]; // Custom scale labels (e.g., ["Never", "Rarely", "Sometimes", "Often", "Always"])
}

export interface ChoiceOptions {
  choices: string[];
  allow_other?: boolean;
}

export interface OpenTextOptions {
  variant: "short" | "long";
  max_length?: number;
}

export interface MatrixOptions {
  rows: string[];
  columns: string[];
}

export interface ConditionRule {
  question_index: number;
  operator: "equals" | "not_equals" | "greater_than" | "less_than";
  value: number | string;
}

export interface QuestionOptions {
  labels?: string[];
  choices?: string[];
  allow_other?: boolean;
  variant?: "short" | "long";
  max_length?: number;
  rows?: string[];
  columns?: string[];
  condition?: ConditionRule;
}

// Full question shape for builder state and API payloads
export interface QuestionInput {
  question_text: string;
  question_type: QuestionType;
  sort_order: number;
  rating_scale_max: number;
  metric_id: number | null;
  options: QuestionOptions;
  is_required: boolean;
  help_text: string;
  section_label: string;
}

// Database row shape (returned from Supabase)
export interface QuestionRow {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: QuestionType;
  sort_order: number;
  rating_scale_max: number;
  metric_id: number | null;
  options: QuestionOptions;
  is_required: boolean;
  help_text: string | null;
  section_label: string | null;
}

export interface SurveyTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string;
  questions: Omit<QuestionInput, "sort_order" | "metric_id">[];
  created_by: string | null;
  is_shared: boolean;
  created_at: string;
}

// Default empty question for the builder
export function createEmptyQuestion(sortOrder: number): QuestionInput {
  return {
    question_text: "",
    question_type: "rating",
    sort_order: sortOrder,
    rating_scale_max: 5,
    metric_id: null,
    options: {},
    is_required: true,
    help_text: "",
    section_label: "",
  };
}

// Default rating labels (used when no custom labels set)
export const DEFAULT_RATING_LABELS: Record<number, string[]> = {
  3: ["Disagree", "Neutral", "Agree"],
  4: ["Strongly Disagree", "Disagree", "Agree", "Strongly Agree"],
  5: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  7: ["Strongly Disagree", "Disagree", "Somewhat Disagree", "Neutral", "Somewhat Agree", "Agree", "Strongly Agree"],
  10: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
};

// NPS scoring helpers
export function getNpsCategory(score: number): "detractor" | "passive" | "promoter" {
  if (score <= 6) return "detractor";
  if (score <= 8) return "passive";
  return "promoter";
}

export function calculateNpsScore(values: number[]): number {
  if (values.length === 0) return 0;
  const promoters = values.filter((v) => v >= 9).length;
  const detractors = values.filter((v) => v <= 6).length;
  return Math.round(((promoters - detractors) / values.length) * 100);
}

// Scale size options for rating questions
export const RATING_SCALE_OPTIONS = [3, 4, 5, 7, 10] as const;
