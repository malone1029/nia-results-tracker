// Shared types and parser functions for AI chat structured output blocks.
// These parse fenced code blocks (```adli-scores, ```coach-suggestions, etc.)
// from streaming AI responses and extract structured data.

import type { ProcessMapFlowData } from "./flow-types";

export interface AdliScores {
  approach: number;
  deployment: number;
  learning: number;
  integration: number;
}

export interface SuggestionTask {
  title: string;
  description: string;
  pdcaSection: "plan" | "execute" | "evaluate" | "improve";
  adliDimension: "approach" | "deployment" | "learning" | "integration";
  priority?: "high" | "medium" | "low";
}

export interface CoachSuggestion {
  id: string;
  field: string;
  priority: "quick-win" | "important" | "long-term";
  effort: "minimal" | "moderate" | "substantial";
  title: string;
  whyMatters: string;
  preview: string;
  // string → normal ADLI/charter markdown content
  // Record<string, string> → charter_cleanup multi-field update
  // ProcessMapFlowData → new React Flow process map (field = "workflow")
  content: string | Record<string, string> | ProcessMapFlowData;
  tasks?: SuggestionTask[];
}

export interface SurveyQuestionSuggestion {
  questionText: string;
  questionType: "rating" | "yes_no";
  rationale: string;
}

export interface MetricSuggestion {
  action: "link" | "create";
  metricId?: number;
  name: string;
  unit: string;
  cadence: string;
  targetValue?: number | null;
  isHigherBetter?: boolean;
  reason: string;
}

export const FIELD_LABELS: Record<string, string> = {
  charter: "Charter",
  adli_approach: "ADLI: Approach",
  adli_deployment: "ADLI: Deployment",
  adli_learning: "ADLI: Learning",
  adli_integration: "ADLI: Integration",
  workflow: "Process Map",
};

// Parse adli-scores code block from AI response, return scores and cleaned text
export function parseAdliScores(text: string): { scores: AdliScores | null; cleanedText: string } {
  const match = text.match(/```adli-scores\s*\n([\s\S]*?)\n```/);
  if (!match) return { scores: null, cleanedText: text };

  try {
    const scores = JSON.parse(match[1]) as AdliScores;
    const cleanedText = text.replace(/```adli-scores\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { scores, cleanedText };
  } catch {
    return { scores: null, cleanedText: text };
  }
}

// Parse coach-suggestions code block from AI response
// Uses greedy match ([\s\S]*) to find the LAST closing ``` — this prevents
// inner triple backticks (e.g., mermaid code fences in workflow content)
// from being mistaken for the end of the block.
export function parseCoachSuggestions(text: string): { suggestions: CoachSuggestion[]; cleanedText: string } {
  const match = text.match(/```coach-suggestions\s*\n([\s\S]*)\n```/);
  if (!match) {
    // Backward compat: also try old adli-suggestion format
    const oldMatch = text.match(/```adli-suggestion\s*\n([\s\S]*)\n```/);
    if (oldMatch) {
      try {
        const old = JSON.parse(oldMatch[1]) as { field: string; content: string };
        const cleanedText = text.replace(/```adli-suggestion\s*\n[\s\S]*\n```\s*\n?/g, "").trim();
        return {
          suggestions: [{
            id: "legacy",
            field: old.field,
            priority: "important",
            effort: "moderate",
            title: `Update ${FIELD_LABELS[old.field] || old.field}`,
            whyMatters: "AI-suggested improvement for this section.",
            preview: "Apply the suggested content to this section.",
            content: old.content,
          }],
          cleanedText,
        };
      } catch { /* fall through */ }
    }
    return { suggestions: [], cleanedText: text };
  }

  try {
    const suggestions = JSON.parse(match[1]) as CoachSuggestion[];
    const cleanedText = text.replace(/```coach-suggestions\s*\n[\s\S]*\n```\s*\n?/, "").trim();
    return { suggestions, cleanedText };
  } catch {
    return { suggestions: [], cleanedText: text };
  }
}

// Parse proposed-tasks code block from AI response
export function parseProposedTasks(text: string): { tasks: SuggestionTask[]; cleanedText: string } {
  const match = text.match(/```proposed-tasks\s*\n([\s\S]*?)\n```/);
  if (!match) return { tasks: [], cleanedText: text };

  try {
    const tasks = JSON.parse(match[1]) as SuggestionTask[];
    const cleanedText = text.replace(/```proposed-tasks\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { tasks, cleanedText };
  } catch {
    return { tasks: [], cleanedText: text };
  }
}

// Parse metric-suggestions code block from AI response
export function parseMetricSuggestions(text: string): { metrics: MetricSuggestion[]; cleanedText: string } {
  const match = text.match(/```metric-suggestions\s*\n([\s\S]*?)\n```/);
  if (!match) return { metrics: [], cleanedText: text };

  try {
    const metrics = JSON.parse(match[1]) as MetricSuggestion[];
    const cleanedText = text.replace(/```metric-suggestions\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { metrics, cleanedText };
  } catch {
    return { metrics: [], cleanedText: text };
  }
}

// Parse survey-questions code block from AI response
export function parseSurveyQuestions(text: string): { questions: SurveyQuestionSuggestion[]; cleanedText: string } {
  const match = text.match(/```survey-questions\s*\n([\s\S]*?)\n```/);
  if (!match) return { questions: [], cleanedText: text };

  try {
    const questions = JSON.parse(match[1]) as SurveyQuestionSuggestion[];
    const cleanedText = text.replace(/```survey-questions\s*\n[\s\S]*?\n```\s*\n?/, "").trim();
    return { questions, cleanedText };
  } catch {
    return { questions: [], cleanedText: text };
  }
}

// Strip partial (still-streaming) structured blocks so raw JSON isn't visible
// coach-suggestions uses greedy ([\s\S]*) to handle nested backticks (e.g., mermaid)
export function stripPartialBlocks(text: string): string {
  // Remove complete structured blocks (scores + suggestions + proposed-tasks)
  let cleaned = text;
  cleaned = cleaned.replace(/```adli-scores\s*\n[\s\S]*?\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```coach-suggestions\s*\n[\s\S]*\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```adli-suggestion\s*\n[\s\S]*\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```proposed-tasks\s*\n[\s\S]*?\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```metric-suggestions\s*\n[\s\S]*?\n```\s*\n?/g, "");
  cleaned = cleaned.replace(/```survey-questions\s*\n[\s\S]*?\n```\s*\n?/g, "");

  // Remove PARTIAL blocks that started but haven't closed yet (still streaming)
  cleaned = cleaned.replace(/```adli-scores[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```coach-suggestions[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```adli-suggestion[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```proposed-tasks[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```metric-suggestions[\s\S]*$/g, "");
  cleaned = cleaned.replace(/```survey-questions[\s\S]*$/g, "");

  return cleaned.trim();
}

// Check if a response has an in-progress structured block (started but not closed)
export function hasPartialBlock(text: string): "scores" | "suggestions" | "tasks" | "metrics" | "survey-questions" | null {
  if (/```adli-scores(?![\s\S]*?```)[\s\S]*$/.test(text)) return "scores";
  if (/```coach-suggestions(?![\s\S]*?```)[\s\S]*$/.test(text)) return "suggestions";
  if (/```proposed-tasks(?![\s\S]*?```)[\s\S]*$/.test(text)) return "tasks";
  if (/```metric-suggestions(?![\s\S]*?```)[\s\S]*$/.test(text)) return "metrics";
  if (/```survey-questions(?![\s\S]*?```)[\s\S]*$/.test(text)) return "survey-questions";
  return null;
}
