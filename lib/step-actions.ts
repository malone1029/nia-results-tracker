// Shared step action definitions used by both ImprovementStepper and AiChatPanel.
// Single source of truth for step labels, prompts, scroll targets, and styling.

export interface StepActionDef {
  key: string;            // unique action key (e.g., "assessment", "metrics")
  label: string;          // full button label
  shortLabel: string;     // mobile-friendly short label
  description: string;    // tooltip / subtitle text
  prompt: string;         // AI prompt sent when clicked
  scrollTarget: string;   // DOM id to scroll to (e.g., "section-charter")
  switchTab?: "overview" | "documentation" | "process-map" | "tasks" | "improvements"; // if set, switch the tab before scrolling
  // Styling for AI chat panel buttons
  color: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
}

export interface StepDef {
  key: string;
  label: string;
  shortLabel: string;
  welcome: string;        // empty-state welcome message in AI panel
  prominence: "normal" | "muted"; // Start/Export are muted
  actions: StepActionDef[];       // first = primary, rest = secondary
}

// ── Step definitions ────────────────────────────────────────────────

export const STEPS: StepDef[] = [
  {
    key: "start",
    label: "Start",
    shortLabel: "Start",
    welcome: "Let's get started! I'll help you understand where this process stands and what to focus on first.",
    prominence: "muted",
    actions: [
      {
        key: "start",
        label: "Get Started",
        shortLabel: "Start",
        description: "welcome + overview of the improvement cycle",
        prompt: "Welcome me to this process and give me an overview of where things stand. What should I focus on first?",
        scrollTarget: "section-top",
        color: "nia-orange",
        borderClass: "border-nia-orange/30",
        bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
        textClass: "text-nia-orange",
      },
      {
        key: "analyze",
        label: "Analyze",
        shortLabel: "Analyze",
        description: "ADLI scores + gaps",
        prompt: "Analyze this process using the ADLI framework. Score each dimension, identify the biggest gaps, and suggest the 2-3 most impactful improvements with effort estimates.",
        scrollTarget: "section-adli",
        color: "nia-grey-blue",
        borderClass: "border-nia-grey-blue/30",
        bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10",
        textClass: "text-nia-grey-blue",
      },
    ],
  },
  {
    key: "charter",
    label: "Charter",
    shortLabel: "Charter",
    welcome: "Let's review your charter. I'll check for mixed content and help you clean it up.",
    prominence: "normal",
    actions: [
      {
        key: "charter",
        label: "Review My Charter",
        shortLabel: "Review",
        description: "check for mixed content, suggest cleanup",
        prompt: "Review this charter briefly. List what content types are mixed in (e.g., ADLI assessments, PDSA cycles, Baldrige links, task lists). For each, say which field it should move to. Keep your response short — just the analysis, no rewritten content yet. I'll ask you to generate the cleanup if I want to proceed.",
        scrollTarget: "section-charter",
        color: "nia-orange",
        borderClass: "border-nia-orange/30",
        bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
        textClass: "text-nia-orange",
      },
      {
        key: "coach",
        label: "Coach Me",
        shortLabel: "Coach",
        description: "quick wins",
        prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now to improve maturity?",
        scrollTarget: "section-charter",
        color: "nia-green",
        borderClass: "border-nia-green/30",
        bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
        textClass: "text-nia-green",
      },
      {
        key: "interview",
        label: "Interview Me",
        shortLabel: "Interview",
        description: "guided questions",
        prompt: "Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.",
        scrollTarget: "section-charter",
        color: "nia-grey-blue",
        borderClass: "border-nia-grey-blue/30",
        bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10",
        textClass: "text-nia-grey-blue",
      },
    ],
  },
  {
    key: "assessment",
    label: "Assessment",
    shortLabel: "Assess",
    welcome: "Time to score your ADLI maturity. I'll assess each dimension and find your biggest gaps.",
    prominence: "normal",
    actions: [
      {
        key: "assessment",
        label: "Run ADLI Assessment",
        shortLabel: "Assess",
        description: "score each dimension, find gaps",
        prompt: "Run a full ADLI assessment. Score each dimension (Approach, Deployment, Learning, Integration) from 0-100. Identify the weakest dimensions and suggest the 2-3 most impactful improvements with effort estimates.",
        scrollTarget: "section-adli",
        color: "nia-orange",
        borderClass: "border-nia-orange/30",
        bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
        textClass: "text-nia-orange",
      },
      {
        key: "metrics",
        label: "Check Metrics",
        shortLabel: "Metrics",
        description: "review linked metrics, find gaps",
        prompt: "Review the metrics linked to this process. Are there gaps in what I'm measuring? Are there existing metrics in the system I should link? Flag any overdue or off-target metrics. Recommend specific metrics to link or create.",
        scrollTarget: "section-metrics",
        color: "nia-green",
        borderClass: "border-nia-green/30",
        bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
        textClass: "text-nia-green",
      },
      {
        key: "review-charter",
        label: "Review Charter",
        shortLabel: "Charter",
        description: "check for mixed content",
        prompt: "Review this charter briefly. List what content types are mixed in (e.g., ADLI assessments, PDSA cycles, Baldrige links). For each, say which field it should move to. Keep your response short — just the analysis.",
        scrollTarget: "section-charter",
        color: "nia-grey-blue",
        borderClass: "border-nia-grey-blue/30",
        bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10",
        textClass: "text-nia-grey-blue",
      },
    ],
  },
  {
    key: "deep_dive",
    label: "Deep Dive",
    shortLabel: "Dive",
    welcome: "Let's dig into your weakest areas and build specific improvements you can apply.",
    prominence: "normal",
    actions: [
      {
        key: "deep_dive",
        label: "Improve Weakest Area",
        shortLabel: "Improve",
        description: "focused suggestions for lowest-scoring dimension",
        prompt: "Focus on the weakest ADLI dimension for this process. Give me specific, actionable improvements with content I can apply. Include effort estimates and tasks.",
        scrollTarget: "section-adli",
        color: "nia-orange",
        borderClass: "border-nia-orange/30",
        bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
        textClass: "text-nia-orange",
      },
      {
        key: "interview",
        label: "Interview Me",
        shortLabel: "Interview",
        description: "guided questions to fill gaps",
        prompt: "Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.",
        scrollTarget: "section-adli",
        color: "nia-grey-blue",
        borderClass: "border-nia-grey-blue/30",
        bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10",
        textClass: "text-nia-grey-blue",
      },
      {
        key: "re-analyze",
        label: "Analyze Again",
        shortLabel: "Re-score",
        description: "re-score after improvements",
        prompt: "Run a fresh ADLI assessment. Score each dimension and compare to where we started. What's improved and what still needs work?",
        scrollTarget: "section-adli",
        color: "nia-green",
        borderClass: "border-nia-green/30",
        bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
        textClass: "text-nia-green",
      },
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    shortLabel: "Tasks",
    welcome: "Ready to build your task list! I'll interview you about what needs to happen and generate PDCA tasks.",
    prominence: "normal",
    actions: [
      {
        key: "tasks",
        label: "Build Task List",
        shortLabel: "Build",
        description: "AI interviews you, generates PDCA tasks",
        prompt: "Help me build a task list for this process. Interview me about what needs to happen — the key steps, who does what, how we measure success, and what training is needed. Work through Plan, Execute, Evaluate, and Improve sections systematically. Ask 2-3 questions at a time, and generate tasks when you have enough context.",
        scrollTarget: "section-tasks",
        switchTab: "tasks",
        color: "nia-dark",
        borderClass: "border-nia-dark/20",
        bgClass: "bg-nia-dark/5 hover:bg-nia-dark/10",
        textClass: "text-nia-dark",
      },
      {
        key: "coach",
        label: "Coach Me",
        shortLabel: "Coach",
        description: "quick wins",
        prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now?",
        scrollTarget: "section-adli",
        color: "nia-green",
        borderClass: "border-nia-green/30",
        bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
        textClass: "text-nia-green",
      },
    ],
  },
  {
    key: "export",
    label: "Export",
    shortLabel: "Export",
    welcome: "Almost there! Let's review everything before you export to Asana.",
    prominence: "muted",
    actions: [
      {
        key: "export",
        label: "Review Before Export",
        shortLabel: "Review",
        description: "check what's ready and what needs work",
        prompt: "Review this process before I export to Asana. Summarize what's strong, what's still weak, and whether the charter and ADLI sections are ready. Flag anything I should fix first.",
        scrollTarget: "section-top",
        color: "nia-green",
        borderClass: "border-nia-green/30",
        bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
        textClass: "text-nia-green",
      },
      {
        key: "more-tasks",
        label: "Build More Tasks",
        shortLabel: "Tasks",
        description: "add tasks before export",
        prompt: "Help me build more tasks for this process before I export. What's missing from the task list?",
        scrollTarget: "section-tasks",
        switchTab: "tasks",
        color: "nia-dark",
        borderClass: "border-nia-dark/20",
        bgClass: "bg-nia-dark/5 hover:bg-nia-dark/10",
        textClass: "text-nia-dark",
      },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

/** Look up a step definition by key */
export function getStepDef(stepKey: string): StepDef | undefined {
  return STEPS.find((s) => s.key === stepKey);
}

/** Get the primary (first) action for a step */
export function getPrimaryAction(stepKey: string): StepActionDef | undefined {
  return getStepDef(stepKey)?.actions[0];
}

/** Get the step index (0-based) */
export function getStepIndex(stepKey: string): number {
  const idx = STEPS.findIndex((s) => s.key === stepKey);
  return idx >= 0 ? idx : 0;
}

// Default actions for processes without a guided step (not linked to Asana)
export const DEFAULT_ACTIONS: StepActionDef[] = [
  {
    key: "analyze",
    label: "Analyze This Process",
    shortLabel: "Analyze",
    description: "ADLI scores + top gaps",
    prompt: "Analyze this process using the ADLI framework. Score each dimension (Approach, Deployment, Learning, Integration), identify the biggest gaps, and suggest the 2-3 most impactful improvements with effort estimates.",
    scrollTarget: "section-adli",
    color: "nia-orange",
    borderClass: "border-nia-orange/30",
    bgClass: "bg-nia-orange/5 hover:bg-nia-orange/10",
    textClass: "text-nia-orange",
  },
  {
    key: "coach",
    label: "Coach Me",
    shortLabel: "Coach",
    description: "quick wins with effort estimates",
    prompt: "Coach me on this process. What are the 2-3 quickest wins I could tackle right now to improve maturity? Focus on what will make the biggest difference with the least effort.",
    scrollTarget: "section-charter",
    color: "nia-green",
    borderClass: "border-nia-green/30",
    bgClass: "bg-nia-green/5 hover:bg-nia-green/10",
    textClass: "text-nia-green",
  },
  {
    key: "interview",
    label: "Interview Me",
    shortLabel: "Interview",
    description: "guided questions to fill gaps",
    prompt: "Help me strengthen this process by asking me targeted questions about what's missing or underdeveloped. Start with the weakest area. Ask 2-3 questions at a time.",
    scrollTarget: "section-charter",
    color: "nia-grey-blue",
    borderClass: "border-nia-grey-blue/30",
    bgClass: "bg-nia-grey-blue/5 hover:bg-nia-grey-blue/10",
    textClass: "text-nia-grey-blue",
  },
  {
    key: "tasks",
    label: "Build Task List",
    shortLabel: "Tasks",
    description: "AI interviews you, generates PDCA tasks",
    prompt: "Help me build a task list for this process. Interview me about what needs to happen — the key steps, who does what, how we measure success, and what training is needed. Work through Plan, Execute, Evaluate, and Improve sections systematically. Ask 2-3 questions at a time, and generate tasks when you have enough context.",
    scrollTarget: "section-tasks",
    switchTab: "tasks",
    color: "nia-dark",
    borderClass: "border-nia-dark/20",
    bgClass: "bg-nia-dark/5 hover:bg-nia-dark/10",
    textClass: "text-nia-dark",
  },
];
