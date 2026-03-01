// PDCA (Plan-Do-Check-Act) constants and ADLI-to-PDCA mapping
// Used across the app for task categorization, UI colors, and AI prompt generation.

import type { PdcaSection, AdliDimension, TaskSource, TaskStatus, TaskOrigin } from './types';

// ── Section metadata ──────────────────────────────────────────

export const PDCA_SECTIONS: Record<
  PdcaSection,
  { label: string; color: string; bgLight: string; description: string }
> = {
  plan: {
    label: 'Plan',
    color: '#55787c', // nia-grey-blue
    bgLight: 'bg-[#55787c]/10',
    description: 'Design, document, and prepare',
  },
  execute: {
    label: 'Execute',
    color: '#b1bd37', // nia-green
    bgLight: 'bg-[#b1bd37]/10',
    description: 'Implement, train, and roll out',
  },
  evaluate: {
    label: 'Evaluate',
    color: '#f79935', // nia-orange
    bgLight: 'bg-[#f79935]/10',
    description: 'Measure, review, and assess',
  },
  improve: {
    label: 'Improve',
    color: '#2d3436', // nia-dark
    bgLight: 'bg-[#2d3436]/10',
    description: 'Refine, iterate, and enhance',
  },
};

// ── ADLI-to-PDCA default mapping ──────────────────────────────
// Each ADLI dimension has a primary and secondary PDCA section.
// The AI uses these as defaults but can override based on context.

export const ADLI_TO_PDCA_MAP: Record<
  AdliDimension,
  { primary: PdcaSection; secondary: PdcaSection }
> = {
  approach: {
    primary: 'plan', // Design/document the method
    secondary: 'execute', // Implement the method
  },
  deployment: {
    primary: 'execute', // Roll out, train, communicate
    secondary: 'plan', // Design the rollout
  },
  learning: {
    primary: 'evaluate', // Measure, survey, review
    secondary: 'plan', // Design the measurement
  },
  integration: {
    primary: 'plan', // Align with strategy, connect processes
    secondary: 'evaluate', // Assess alignment
  },
};

// ── Helpers ───────────────────────────────────────────────────

export function getPdcaLabel(section: PdcaSection): string {
  return PDCA_SECTIONS[section]?.label ?? section;
}

export function getPdcaColor(section: PdcaSection): string {
  return PDCA_SECTIONS[section]?.color ?? '#6b7280';
}

export const PDCA_SECTION_VALUES: PdcaSection[] = ['plan', 'execute', 'evaluate', 'improve'];
export const ADLI_DIMENSION_VALUES: AdliDimension[] = [
  'approach',
  'deployment',
  'learning',
  'integration',
];
export const TASK_SOURCE_VALUES: TaskSource[] = ['ai_suggestion', 'ai_interview', 'user_created'];
export const TASK_STATUS_VALUES: TaskStatus[] = ['pending', 'active', 'completed', 'exported'];
export const TASK_ORIGIN_VALUES: TaskOrigin[] = ['asana', 'hub_ai', 'hub_manual'];

// ── AI Prompt Fragment ────────────────────────────────────────
// Include this in the AI system prompt so it knows how to map tasks.

export const ADLI_TO_PDCA_PROMPT = `## ADLI-to-PDCA Task Mapping

When generating tasks for a suggestion, place each task in the right PDCA section:

| ADLI Dimension | Primary PDCA Section | Secondary PDCA Section | Examples |
|---|---|---|---|
| **Approach** | **Plan** (design/document the method) | Execute (implement the method) | Plan: "Document the intake procedure" / Execute: "Implement new intake workflow" |
| **Deployment** | **Execute** (roll out, train, communicate) | Plan (design the rollout) | Execute: "Train all staff on the new protocol" / Plan: "Create deployment checklist" |
| **Learning** | **Evaluate** (measure, survey, review) | Plan (design the measurement) | Evaluate: "Conduct quarterly satisfaction survey" / Plan: "Design survey questions" |
| **Integration** | **Plan** (align with strategy, connect processes) | Evaluate (assess alignment) | Plan: "Map process outputs to strategic goals" / Evaluate: "Review cross-department alignment" |

Rules:
- A single suggestion can generate tasks in MULTIPLE sections (e.g., "Create training" → Plan: design training + Execute: deliver training)
- Use your judgment — context overrides defaults (e.g., if a Learning improvement is about building a new dashboard, that's Plan, not Evaluate)
- 1-5 tasks per suggestion, spread across at least 1-2 sections
- Each task should be concrete and assignable to a person`;
