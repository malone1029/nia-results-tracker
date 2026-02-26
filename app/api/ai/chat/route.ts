import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import { ADLI_TO_PDCA_PROMPT } from "@/lib/pdca";
import { getReviewStatus } from "@/lib/review-status";
import { checkRateLimit } from "@/lib/rate-limit";

// Allow up to 120 seconds for AI streaming responses (requires Vercel Pro)
export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000, // 115s — slightly under maxDuration so we can send a clean error
  maxRetries: 0, // Don't retry on timeout — the user can retry manually
});

// Build a readable summary of the process for the AI context
function buildProcessContext(process: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`## Process: ${process.name}`);
  lines.push(`- **Status:** ${process.status}`);
  lines.push(`- **Baldrige Category:** ${process.category_display_name || "Unknown"}`);
  if (process.baldrige_item) lines.push(`- **Baldrige Item:** ${process.baldrige_item}`);
  if (process.owner) lines.push(`- **Owner:** ${process.owner}`);
  if (process.process_type === "key") lines.push(`- **Process Type:** Key`);
  else if (process.process_type === "support") lines.push(`- **Process Type:** Support`);
  if (process.guided_step) lines.push(`- **Guided Step:** ${process.guided_step}`);
  lines.push("");

  if (process.description) {
    lines.push(`### Description`);
    lines.push(String(process.description));
    lines.push("");
  }

  // Charter (cap at 2000 chars to keep context lean — AI can request full text if needed)
  const charter = process.charter as Record<string, unknown> | null;
  if (charter) {
    lines.push(`### Charter`);
    if (charter.content) {
      const charterText = String(charter.content);
      lines.push(charterText.length > 2000 ? charterText.slice(0, 2000) + "\n\n*[Charter truncated — full text available in process]*" : charterText);
    } else {
      if (charter.purpose) lines.push(`**Purpose:** ${charter.purpose}`);
      if (charter.scope_includes) lines.push(`**Scope (Includes):** ${charter.scope_includes}`);
      if (charter.scope_excludes) lines.push(`**Scope (Excludes):** ${charter.scope_excludes}`);
      if (charter.mission_alignment) lines.push(`**Mission Alignment:** ${charter.mission_alignment}`);
      if (Array.isArray(charter.stakeholders) && charter.stakeholders.length > 0) {
        lines.push(`**Stakeholders:** ${charter.stakeholders.join(", ")}`);
      }
    }
    lines.push("");
  }

  // ADLI sections
  const adliSections = [
    { key: "adli_approach", label: "Approach" },
    { key: "adli_deployment", label: "Deployment" },
    { key: "adli_learning", label: "Learning" },
    { key: "adli_integration", label: "Integration" },
  ];

  for (const section of adliSections) {
    const data = process[section.key] as Record<string, unknown> | null;
    if (data) {
      lines.push(`### ADLI: ${section.label}`);
      if (data.content) {
        const adliText = String(data.content);
        lines.push(adliText.length > 1500 ? adliText.slice(0, 1500) + "\n*[Truncated]*" : adliText);
      } else {
        for (const [key, value] of Object.entries(data)) {
          if (key === "content" || !value) continue;
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          if (Array.isArray(value) && value.length > 0) {
            lines.push(`**${label}:** ${value.join(", ")}`);
          } else if (typeof value === "string") {
            lines.push(`**${label}:** ${value}`);
          }
        }
      }
      lines.push("");
    }
  }

  // Workflow
  const workflow = process.workflow as Record<string, unknown> | null;
  if (workflow) {
    lines.push(`### Workflow`);
    if (workflow.content) {
      lines.push(String(workflow.content));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function computeTrend(values: number[], isHigherBetter: boolean): string {
  if (values.length < 2) return "insufficient data";
  const improving = isHigherBetter
    ? values.every((v, i) => i === 0 || v >= values[i - 1])
    : values.every((v, i) => i === 0 || v <= values[i - 1]);
  const declining = isHigherBetter
    ? values.every((v, i) => i === 0 || v <= values[i - 1])
    : values.every((v, i) => i === 0 || v >= values[i - 1]);
  if (improving) return "improving";
  if (declining) return "declining";
  return "mixed";
}

function buildMetricsContext(metrics: Record<string, unknown>[]): string {
  if (metrics.length === 0) return "\n### Linked Metrics\nNo metrics linked to this process yet. Consider linking relevant metrics to strengthen the Learning dimension.\n";

  const lines = ["\n### Linked Metrics"];
  for (const m of metrics) {
    const lastValue = m.last_value as number | null;
    const target = m.target_value as number | null;
    const unit = m.unit as string;
    const isHigherBetter = m.is_higher_better as boolean;
    const recentValues = (m.recent_values || []) as number[];
    const reviewStatus = m.review_status as string;

    let valuePart = lastValue !== null ? `${lastValue} ${unit}` : "No data yet";
    if (target !== null && lastValue !== null) {
      const onTarget = isHigherBetter ? lastValue >= target : lastValue <= target;
      valuePart += ` (target: ${target} ${unit}, ${onTarget ? "on target" : "OFF TARGET"})`;
    } else if (target !== null) {
      valuePart += ` (target: ${target} ${unit})`;
    }

    lines.push(`- **${m.name}** (${m.cadence}): ${valuePart}`);

    if (recentValues.length >= 2) {
      const trend = computeTrend(recentValues, isHigherBetter);
      lines.push(`  Trend (last ${recentValues.length}): ${recentValues.join(" → ")} ${unit} — ${trend}`);
    }

    if (reviewStatus && reviewStatus !== "current") {
      lines.push(`  Review status: **${reviewStatus.replace("-", " ")}**`);
    }
  }
  return lines.join("\n") + "\n";
}

function buildAvailableMetricsContext(metrics: { id: number; name: string; unit: string; cadence: string; category: string }[]): string {
  if (metrics.length === 0) return "";

  const lines = ["\n### Available Metrics (Not Linked to This Process)"];
  lines.push("These metrics exist in the system and could be linked to this process if relevant:\n");

  let charCount = 0;
  const MAX_CHARS = 1500;

  for (const m of metrics.slice(0, 20)) {
    const line = `- **${m.name}** [id:${m.id}] — ${m.cadence}, ${m.unit} (${m.category})`;
    charCount += line.length;
    if (charCount > MAX_CHARS) {
      lines.push(`\n*...and ${metrics.length - lines.length + 2} more metrics available*`);
      break;
    }
    lines.push(line);
  }
  return lines.join("\n") + "\n";
}

interface SurveyContextData {
  title: string;
  question_count: number;
  latest_wave: {
    wave_number: number;
    status: string;
    response_count: number;
  } | null;
  results: {
    question_text: string;
    question_type: string;
    avg_value: number;
    response_count: number;
  }[];
}

function buildSurveyContext(surveys: SurveyContextData[]): string {
  if (surveys.length === 0) return "\n### Process Surveys\nNo surveys created yet. Consider creating a micro-survey to collect stakeholder feedback — this strengthens the Learning dimension.\n";

  const lines = ["\n### Process Surveys"];
  let charCount = 0;
  const MAX_CHARS = 1000;

  for (const s of surveys) {
    const wavePart = s.latest_wave
      ? `Wave ${s.latest_wave.wave_number} (${s.latest_wave.status}, ${s.latest_wave.response_count} responses)`
      : "Not deployed yet";
    lines.push(`- **${s.title}** — ${s.question_count} questions, ${wavePart}`);
    charCount += 80;

    if (s.results.length > 0) {
      for (const r of s.results) {
        const valStr = r.question_type === "yes_no"
          ? `${Math.round(r.avg_value * 100)}% Yes`
          : `${r.avg_value.toFixed(1)}/5`;
        const line = `  - "${r.question_text}" — ${valStr} (${r.response_count} responses)`;
        charCount += line.length;
        if (charCount > MAX_CHARS) break;
        lines.push(line);
      }
    }
    if (charCount > MAX_CHARS) break;
  }
  return lines.join("\n") + "\n";
}

interface TaskContextRow {
  title: string;
  description: string | null;
  status: string;
  pdca_section: string | null;
  adli_dimension: string | null;
  assignee_name: string | null;
  due_date: string | null;
  completed: boolean;
  origin: string | null;
  asana_section_name: string | null;
  priority: string | null;
}

function buildTaskContext(tasks: TaskContextRow[]): string {
  if (tasks.length === 0) return "\n### Process Tasks\nNo tasks exist for this process yet.\n";

  const today = new Date().toISOString().slice(0, 10);
  const active = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const overdue = active.filter((t) => t.due_date && t.due_date < today);
  const withAssignee = tasks.filter((t) => t.assignee_name);
  const withDueDate = tasks.filter((t) => t.due_date);

  const highPriority = active.filter((t) => t.priority === "high");
  const lowPriority = active.filter((t) => t.priority === "low");

  const lines: string[] = ["\n### Process Tasks"];
  lines.push(`**Summary:** ${tasks.length} total — ${active.length} active, ${completed.length} completed, ${overdue.length} overdue`);
  lines.push(`**Priority:** ${highPriority.length} high, ${active.length - highPriority.length - lowPriority.length} medium, ${lowPriority.length} low`);
  lines.push(`**Coverage:** ${withAssignee.length}/${tasks.length} have assignees, ${withDueDate.length}/${tasks.length} have due dates`);
  lines.push("");

  // Cap at ~4000 chars
  let charCount = 0;
  const MAX_CHARS = 4000;

  // Active and overdue tasks — full detail
  if (active.length > 0) {
    lines.push("**Active Tasks:**");
    for (const t of active) {
      const assignee = t.assignee_name ? ` [${t.assignee_name}]` : "";
      const due = t.due_date ? ` due ${t.due_date}` : "";
      const isOverdue = t.due_date && t.due_date < today;
      const overdueFlag = isOverdue ? " **OVERDUE**" : "";
      const section = t.asana_section_name || t.pdca_section || "";
      const sectionPart = section ? ` (${section})` : "";
      const origin = t.origin === "asana" ? " [Asana]" : "";
      const priorityFlag = t.priority === "high" ? " **[HIGH]**" : t.priority === "low" ? " [low]" : "";

      let line = `- ${t.title}${priorityFlag}${assignee}${due}${overdueFlag}${sectionPart}${origin}`;
      if (t.description) {
        const desc = t.description.length > 150 ? t.description.slice(0, 150) + "..." : t.description;
        line += `\n  ${desc}`;
      }
      line += "\n";

      charCount += line.length;
      if (charCount > MAX_CHARS) {
        lines.push(`  ...and ${active.length - lines.filter((l) => l.startsWith("- ")).length} more active tasks\n`);
        break;
      }
      lines.push(line);
    }
  }

  // Completed tasks — titles only
  if (completed.length > 0 && charCount < MAX_CHARS) {
    lines.push("**Completed Tasks:**");
    for (const t of completed) {
      const line = `- ~~${t.title}~~\n`;
      charCount += line.length;
      if (charCount > MAX_CHARS) {
        lines.push(`  ...and ${completed.length} more completed tasks\n`);
        break;
      }
      lines.push(line);
    }
  }

  return lines.join("\n");
}

function buildRequirementsContext(requirements: Record<string, unknown>[]): string {
  if (requirements.length === 0) return "\n### Linked Key Requirements\nNo key requirements linked yet.\n";

  const lines = ["\n### Linked Key Requirements"];
  for (const r of requirements) {
    lines.push(`- **${r.requirement}** (${r.stakeholder_group})`);
  }
  return lines.join("\n") + "\n";
}

function buildStrategicObjectivesContext(objectives: { title: string; bsc_perspective: string; target_value: number | null; target_unit: string | null; target_year: number | null }[]): string {
  if (objectives.length === 0) return "\n### Linked Strategic Objectives\nThis process has not been linked to any FY26 strategic objectives yet.\n";

  const perspectiveLabel: Record<string, string> = {
    financial: "Financial Stability",
    org_capacity: "Organizational Capacity",
    internal_process: "Internal Processes",
    customer: "Customer Satisfaction",
  };

  const lines = ["\n### Linked Strategic Objectives"];
  for (const o of objectives) {
    const perspective = perspectiveLabel[o.bsc_perspective] ?? o.bsc_perspective;
    const target = o.target_value !== null
      ? ` — Target: ${o.target_value}${o.target_unit ? ` ${o.target_unit}` : ""}${o.target_year ? ` by FY${String(o.target_year).slice(2)}` : ""}`
      : "";
    lines.push(`- **${o.title}** (${perspective})${target}`);
  }
  return lines.join("\n") + "\n";
}

const SYSTEM_PROMPT = `You are a process improvement coach for NIA (a healthcare organization) that uses the Malcolm Baldrige Excellence Framework. You're a supportive coach, not an auditor — you focus on the most impactful next step, not everything that could be better.

## Your Coaching Style
- **Focused:** Give 2-3 suggestions max per response. Pick the ones that will have the biggest impact.
- **Encouraging:** Acknowledge what's working before pointing out gaps.
- **Practical:** Include effort estimates so the user can prioritize. A "quick win" matters more than a perfect plan.
- **Specific:** Reference actual content from the process. Never give generic advice.
- **Plain English:** Avoid jargon. If you use a Baldrige term, explain it briefly.

## Grounding Rules (CRITICAL — Read Before Every Response)

You MUST follow these rules to avoid generating inaccurate content:

1. **Only state facts that appear in the process data below.** If a detail isn't in the charter, ADLI sections, Asana data, metrics, or uploaded files — you don't know it. Don't invent it.
2. **Never fabricate specific details.** This includes: names of people, teams, or departments; dates, timelines, or frequencies; statistics, percentages, or metrics values; names of tools, systems, or software; specific procedures, protocols, or forms; regulatory requirements or standards (unless directly stated in the data).
3. **Use placeholder markers when information is missing.** When you need to reference something you don't have data for:
   - Use \`[VERIFY: description]\` for claims you're inferring but aren't certain about — e.g., "[VERIFY: quarterly review cadence]"
   - Use \`[INSERT: what's needed]\` for details the user must fill in — e.g., "[INSERT: team lead name]", "[INSERT: specific metric target]"
4. **Ask instead of assuming.** If you need specific facts to write a good suggestion, ask the user 2-3 focused questions rather than making something up.
5. **Distinguish "what exists" from "what should exist."** When writing ADLI content, clearly separate current-state descriptions (based on data) from aspirational recommendations (your coaching). For example: "Currently, reviews happen [INSERT: frequency]. Consider establishing a quarterly cadence to strengthen the Learning dimension."

These rules apply to ALL content you generate — ADLI sections, charter text, task descriptions, and conversational responses.

## The ADLI Framework

ADLI = Approach, Deployment, Learning, Integration. It's how Baldrige evaluates process maturity.

- **Approach:** Is there a systematic, repeatable method? (Evidence-based, documented, rationale)
- **Deployment:** Is it applied consistently? (Scope defined, roles clear, training exists)
- **Learning:** Is it measured and improved? (Metrics, review cycles, documented changes)
- **Integration:** Does it connect to strategy? (Links to goals, related processes, shared measures)

Maturity levels: Reacting (0-25%), Early Systematic (30-45%), Aligned (50-65%), Integrated (70-100%)

## How to Coach

1. **Start with the weakest dimension** — focus your energy where it'll make the most difference
2. **Check the Improvement Journal** — if something was already improved recently, move to the next gap. Don't suggest what's already been done.
3. **Check Process Tasks** — before suggesting new tasks, review the existing tasks in the Process Tasks section. Do NOT suggest tasks that already exist (even if incomplete). Instead, reference existing tasks and suggest next steps or improvements.
4. **Offer 2-3 actionable options** with effort levels, not a comprehensive audit
5. **Ask questions** when you need more info — 2-3 at a time, focused on the weakest area
6. **Nudge on journal entries** — if the edit log has 3+ entries but the Improvement Journal is empty, gently remind the user to record what they've actually improved. Example: "You've made several updates recently — consider adding an entry to the Improvement Journal to capture what changed and why."
7. **Call out task hygiene** — if many tasks lack assignees or due dates, if several are overdue, or if all tasks are the same priority (no differentiation), mention it as a practical next step. High-priority overdue tasks deserve special attention. Good task hygiene directly improves the health score.

## Structured Scores (IMPORTANT)
When you perform an ADLI analysis, include a scores block at the START of your response:

\`\`\`adli-scores
{"approach": 70, "deployment": 60, "learning": 45, "integration": 65}
\`\`\`

Scores are percentages (0-100). Only include when doing an analysis/assessment.

## Coach Suggestions (IMPORTANT)
When suggesting improvements, include a suggestions block at the END of your response. Each suggestion is an option the user can apply:

\`\`\`coach-suggestions
[
  {
    "id": "s1",
    "field": "adli_learning",
    "priority": "quick-win",
    "effort": "minimal",
    "title": "Add a quarterly review cadence",
    "whyMatters": "Without scheduled reviews, improvements only happen when something breaks.",
    "preview": "Add a quarterly review cycle with specific metrics to track.",
    "content": "The full improved markdown content for the section goes here. Write the COMPLETE section, incorporating what exists PLUS your improvements.",
    "tasks": [
      {
        "title": "Design quarterly review template",
        "description": "Create a standard template for quarterly process reviews including metrics checklist and improvement log.",
        "pdcaSection": "plan",
        "adliDimension": "learning",
        "priority": "high"
      },
      {
        "title": "Schedule first quarterly review meeting",
        "description": "Set up a recurring quarterly review meeting with all process stakeholders.",
        "pdcaSection": "evaluate",
        "adliDimension": "learning",
        "priority": "medium"
      }
    ]
  }
]
\`\`\`

Field values for "field": "charter", "adli_approach", "adli_deployment", "adli_learning", "adli_integration", "workflow"
Priority values: "quick-win" (easy, high impact), "important" (medium effort, high impact), "long-term" (significant effort)
Effort values: "minimal" (< 30 min), "moderate" (1-2 hours), "substantial" (half day+)
Task pdcaSection values: "plan", "execute", "evaluate", "improve"
Task adliDimension values: "approach", "deployment", "learning", "integration"
Task priority values: "high" (urgent or blocking), "medium" (default), "low" (nice-to-have)

Rules for suggestions:
- Maximum 3 suggestions per response
- Each "content" must be complete, standalone markdown — not a diff
- Focus on the weakest dimension first
- Include effort estimates to help users prioritize
- If the improvement history shows something was recently addressed in a dimension, skip it and focus elsewhere
- **Each suggestion MUST include a "tasks" array** with 1-5 concrete, assignable tasks
- Tasks should be spread across at least 1-2 PDCA sections (use the mapping rules below)
- Each task title should be action-oriented and specific (e.g., "Train nursing staff on new intake form" not "Do training")
- **NEVER invent facts in suggestion content.** Only include details that appear in the process data. Use [VERIFY: ...] for inferred claims and [INSERT: ...] for details the user must provide. Example: "The team conducts reviews [INSERT: how often — e.g., quarterly, monthly] to assess process effectiveness."

Only include this block when you are proposing specific improvements. Do NOT include it for general questions or task-building interviews.

## Process Map Generation (React Flow JSON)

When the user asks you to generate a process map, create a visual process diagram, or you determine one would be valuable:

1. Generate a React Flow node/edge structure based on the charter, ADLI sections, and any existing workflow data
2. Output it as a coach-suggestion with \`"field": "workflow"\` — the content MUST be a JSON **object** (not a string):

\`\`\`coach-suggestions
[
  {
    "id": "map1",
    "field": "workflow",
    "priority": "quick-win",
    "effort": "minimal",
    "title": "Process Map",
    "whyMatters": "A visual flowchart makes the process easier to understand and share with stakeholders.",
    "preview": "Interactive flowchart showing the key steps, decision points, and responsible parties.",
    "content": {
      "nodes": [
        {"id": "start", "type": "start", "label": "Start"},
        {"id": "s1", "type": "step", "label": "Receive Referral", "responsible": "Coordinator"},
        {"id": "d1", "type": "decision", "label": "Eligible?"},
        {"id": "s2", "type": "step", "label": "Schedule Service", "responsible": "Scheduler"},
        {"id": "end", "type": "end", "label": "End"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "s1"},
        {"id": "e2", "source": "s1", "target": "d1"},
        {"id": "e3", "source": "d1", "target": "s2", "label": "Yes"},
        {"id": "e4", "source": "d1", "target": "end", "label": "No"},
        {"id": "e5", "source": "s2", "target": "end"}
      ]
    },
    "tasks": []
  }
]
\`\`\`

Rules for process maps:
- Must have exactly one \`"type": "start"\` node and at least one \`"type": "end"\` node
- Node types: \`"start"\`, \`"end"\`, \`"step"\`, \`"decision"\`, \`"input"\`, \`"output"\`
- Use descriptive labels from the actual process (not generic "Step 1") — max 40 chars
- Include \`"responsible"\` on step nodes where relevant (e.g., "Coordinator", "Admin")
- Decision node edges should have \`"label": "Yes"\` or \`"label": "No"\`
- Aim for 6–15 nodes — focus on key milestones, not every micro-step
- If workflow.flow_data already exists, use it as the starting point and modify based on user feedback
- The "content" field must be a valid JSON **object** with "nodes" and "edges" arrays
- Tasks array can be empty for process map suggestions

${ADLI_TO_PDCA_PROMPT}

## Metric Recommendations (IMPORTANT)

When doing ADLI assessments or deep dives, check the process metrics:
1. **No metrics linked?** Flag this as a gap — the Learning dimension can't score well without measurement.
2. **ADLI Learning section mentions measurement but no matching metric?** Recommend linking one from the Available Metrics list.
3. **Linked metrics off-target or declining?** Call this out — it may indicate the process needs improvement.
4. **Available metric clearly matches this process?** Recommend linking it.

When recommending metrics, use the \`metric-suggestions\` block:

\`\`\`metric-suggestions
[
  {
    "action": "link",
    "metricId": 42,
    "name": "Patient Satisfaction Score",
    "unit": "%",
    "cadence": "quarterly",
    "reason": "Your Learning section mentions tracking satisfaction but no metric is linked."
  },
  {
    "action": "create",
    "name": "Response Time to Referrals",
    "unit": "days",
    "cadence": "monthly",
    "targetValue": 3,
    "isHigherBetter": false,
    "reason": "Your charter mentions reducing referral delays but there's no metric tracking this."
  }
]
\`\`\`

Rules for metric suggestions:
- **Maximum 2 metric suggestions per response**
- **NEVER combine \`metric-suggestions\` with \`coach-suggestions\` in the same response** — pick one type or the other. This prevents response timeouts.
- For "link" actions: include the \`metricId\` from the Available Metrics list (the [id:N] shown in the list)
- For "create" actions: propose sensible defaults for name, unit, cadence, and target — the user can edit before confirming
- Only suggest metrics during assessments, deep dives, or when the user specifically asks about measurement
- Don't suggest metrics that are already linked to the process

## Build Task List Mode (Interview)

When the user asks you to "Build Task List" or help them create process tasks:

1. **Interview first, don't guess.** Ask 2-3 focused questions at a time about the process steps, who does what, when, and how success is measured.
2. **Work through PDCA systematically:**
   - Start with **Plan** — what needs to be documented, designed, or prepared?
   - Then **Execute** — who does the work, what training is needed, how is it communicated?
   - Then **Evaluate** — how do you measure success, what data do you collect, how often do you review?
   - Then **Improve** — what changes have been made, what's the cycle for improvements?
3. **After 3-5 exchanges** (or when you have enough context), generate a batch of tasks using the proposed-tasks block.
4. **Reference the process documentation** to pre-fill what you already know — don't ask about things that are documented in the charter or ADLI sections.

When generating tasks, use this block format:

\`\`\`proposed-tasks
[
  {
    "title": "Document the intake assessment procedure",
    "description": "Write step-by-step instructions for the initial client intake assessment including required forms and timeline.",
    "pdcaSection": "plan",
    "adliDimension": "approach",
    "priority": "high"
  },
  {
    "title": "Train front-desk staff on new intake form",
    "description": "Schedule and deliver a 30-minute training session covering the updated intake form and common questions.",
    "pdcaSection": "execute",
    "adliDimension": "deployment",
    "priority": "medium"
  }
]
\`\`\`

Rules for proposed-tasks:
- Generate 3-8 tasks per batch, spread across at least 2-3 PDCA sections
- Each task should be concrete and assignable (specific action + who/what/when)
- Use the ADLI-to-PDCA mapping rules above
- Include a brief description (1-2 sentences) for each task
- You can also update process text (charter/ADLI) alongside generating tasks — include coach-suggestions blocks when the process documentation itself should change

## Charter Cleanup Detection

IMPORTANT: Always check the charter for mixed content. A charter should ONLY contain the process purpose, overview, scope, and key stakeholders. If you see ANY of these in the charter, it needs cleanup:
- ADLI content (Approach, Deployment, Learning, Integration descriptions)
- PDSA/PDCA cycle descriptions
- Baldrige Framework category links
- LeTCI or results framework content
- Task lists or operational items (e.g., "- Send calendar invite")
- Maturity assessments or scoring criteria

This is the MOST COMMON issue — charters imported from Asana often have everything crammed together. When the guided step is "assessment", ALWAYS check the charter first and offer cleanup before scoring.

When you detect mixed content:
1. Point out exactly what content belongs elsewhere (e.g., "Your charter has ADLI assessments and Baldrige links mixed in")
2. Offer to separate it — use field type "charter_cleanup" in your suggestion
3. The content should be an object with cleaned versions of each field:

\`\`\`coach-suggestions
[
  {
    "id": "cleanup1",
    "field": "charter_cleanup",
    "priority": "quick-win",
    "effort": "minimal",
    "title": "Separate task lists from process documentation",
    "whyMatters": "ADLI documentation should describe your systematic approach, not list operational tasks.",
    "preview": "Move task items to where they belong and keep the documentation clean.",
    "content": {
      "charter": "The cleaned charter text with only process documentation...",
      "adli_approach": "Process description extracted from the charter that belongs here...",
      "adli_deployment": "Deployment documentation..."
    },
    "tasks": []
  }
]
\`\`\`

Only include fields in the content object that have content to set. This is a multi-field update.

## Guided Flow Awareness

The process has a "Guided Step" field that tracks where the user is in the improvement cycle. Guide them to the appropriate next action:

- **start** → Welcome them, suggest reviewing or creating a charter first
- **charter** → Help them write or refine the charter. When done, suggest running an ADLI assessment
- **assessment** → FIRST check if the charter has mixed content (ADLI, PDSA, Baldrige links crammed in) and offer cleanup. THEN run an ADLI gap analysis with scores. Identify the weakest dimensions
- **deep_dive** → Focus on the weakest dimension. Offer specific improvements with tasks
- **tasks** → Help build a task list (interview mode). Suggest reviewing and exporting when done
- **export** → Remind them to export to Asana. After that, work in Asana until next refresh
- **complete** → Celebrate progress! Suggest refreshing from Asana when they're ready for the next cycle

Don't force the flow — if the user asks about something else, help them. But gently nudge toward the next step when appropriate.

## Survey Question Suggestions

When the user asks for help designing a survey, or when you identify a measurement gap that could be filled by stakeholder feedback, suggest survey questions using this block:

\`\`\`survey-questions
[
  {
    "questionText": "How well does our intake process meet your needs?",
    "questionType": "rating",
    "rationale": "Directly measures stakeholder satisfaction with the process being improved."
  },
  {
    "questionText": "Did you receive adequate communication about the process change?",
    "questionType": "yes_no",
    "rationale": "Tracks Deployment dimension — whether changes are being communicated effectively."
  }
]
\`\`\`

Rules for survey-questions:
- **Maximum 5 survey questions per suggestion** — micro-surveys get better response rates
- Tie each question to a specific ADLI dimension or metric gap
- Include a clear rationale for each question
- Prefer rating questions (1-5 scale) for satisfaction/quality measures
- Use yes_no questions for compliance/completion checks
- **NEVER combine \`survey-questions\` with \`coach-suggestions\` or \`metric-suggestions\`** in the same response

When survey data is available in the process context below, reference specific findings. Survey results are direct evidence for the Learning dimension — mention specific scores, trends, and response rates in your coaching.

## Important Rules
- **GROUND EVERY CLAIM in the process data below.** If a fact isn't in the data, don't state it. Use [VERIFY: ...] or [INSERT: ...] markers instead.
- When a section is empty, that IS a gap — note it. Don't fill it with invented details.
- Score each ADLI dimension independently.
- Check the Improvement History section to avoid suggesting changes that were already made.
- When writing ADLI content for suggestions, re-read the Grounding Rules above. The most common mistake is inventing specific names, frequencies, tools, or procedures that aren't in the data.`;

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  try {
    const { processId, messages } = await request.json();

    if (!processId || !messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "processId and messages array are required" },
        { status: 400 }
      );
    }

    // Rate limit check — uses auth user ID as key
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const rl = await checkRateLimit(authUser.id);
      if (!rl.success) return rl.response;
    }

    // Load process data from Supabase
    const { data: procData, error: procError } = await supabase
      .from("processes")
      .select(`*, categories!inner ( display_name )`)
      .eq("id", processId)
      .single();

    if (procError || !procData) {
      return Response.json(
        { error: "Process not found" },
        { status: 404 }
      );
    }

    // Add category display name to flat object
    const cat = procData.categories as Record<string, unknown>;
    procData.category_display_name = cat.display_name;

    // Load linked metrics via junction table
    const { data: metricLinks } = await supabase
      .from("metric_processes")
      .select("metric_id")
      .eq("process_id", processId);

    const metricIds = (metricLinks || []).map((l: { metric_id: number }) => l.metric_id);

    const { data: metricsData } = metricIds.length > 0
      ? await supabase
          .from("metrics")
          .select("id, name, unit, cadence, target_value, is_higher_better")
          .in("id", metricIds)
      : { data: [] as { id: number; name: string; unit: string; cadence: string; target_value: number | null; is_higher_better: boolean }[] };

    let metricsWithValues: Record<string, unknown>[] = [];
    if (metricsData && metricsData.length > 0) {
      const { data: entries } = await supabase
        .from("entries")
        .select("metric_id, value, date")
        .in("metric_id", metricsData.map((m) => m.id))
        .order("date", { ascending: false });

      // Build last 3 values (chronological) and latest date per metric
      const recentByMetric = new Map<number, { values: number[]; latestDate: string | null }>();
      if (entries) {
        for (const e of entries) {
          const existing = recentByMetric.get(e.metric_id) || { values: [], latestDate: null };
          if (existing.values.length < 3) {
            existing.values.push(e.value);
          }
          if (!existing.latestDate) existing.latestDate = e.date;
          recentByMetric.set(e.metric_id, existing);
        }
      }

      metricsWithValues = metricsData.map((m) => {
        const recent = recentByMetric.get(m.id);
        const recentValues = recent ? [...recent.values].reverse() : []; // chronological order
        return {
          ...m,
          last_value: recentValues.length > 0 ? recentValues[recentValues.length - 1] : null,
          recent_values: recentValues,
          review_status: getReviewStatus(m.cadence, recent?.latestDate || null),
        };
      });
    }

    // Load linked requirements
    const { data: reqLinks } = await supabase
      .from("process_requirements")
      .select(`requirement_id, key_requirements!inner ( id, requirement, stakeholder_group )`)
      .eq("process_id", processId);

    const requirements = (reqLinks || []).map((link) => {
      const req = link.key_requirements as unknown as Record<string, unknown>;
      return { requirement: req.requirement, stakeholder_group: req.stakeholder_group };
    });

    // Load linked strategic objectives
    const { data: objLinks } = await supabase
      .from("process_objectives")
      .select(`objective_id, strategic_objectives!inner ( title, bsc_perspective, target_value, target_unit, target_year )`)
      .eq("process_id", processId);

    const strategicObjectives = (objLinks || []).map((link) => {
      return link.strategic_objectives as unknown as {
        title: string;
        bsc_perspective: string;
        target_value: number | null;
        target_unit: string | null;
        target_year: number | null;
      };
    });

    // Load available (unlinked) metrics for AI recommendation context
    const { data: allMetricsData } = await supabase
      .from("metrics")
      .select("id, name, unit, cadence")
      .order("name");

    // Get category for each metric via junction + process lookup
    const { data: allLinks } = await supabase
      .from("metric_processes")
      .select("metric_id, process_id");

    const { data: allProcesses } = await supabase
      .from("processes")
      .select("id, categories!inner ( display_name )");

    // Build process → category map
    const processCategoryMap = new Map<number, string>();
    for (const p of (allProcesses || []) as Record<string, unknown>[]) {
      const cat2 = p.categories as Record<string, unknown>;
      processCategoryMap.set(p.id as number, cat2.display_name as string);
    }

    // Build metric → category map (from first linked process)
    const metricCategoryMap = new Map<number, string>();
    for (const link of allLinks || []) {
      if (metricCategoryMap.has(link.metric_id)) continue;
      const cat2 = processCategoryMap.get(link.process_id);
      if (cat2) metricCategoryMap.set(link.metric_id, cat2);
    }

    const linkedMetricIdSet = new Set(metricIds);
    const availableMetrics = (allMetricsData || [])
      .filter((m) => !linkedMetricIdSet.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        cadence: m.cadence,
        category: metricCategoryMap.get(m.id) || "Unlinked",
      }));

    // Load uploaded files for this process
    const { data: filesData } = await supabase
      .from("process_files")
      .select("file_name, file_type, content")
      .eq("process_id", processId);

    // Build file context (text files only — images handled separately)
    let filesContext = "";
    const imageFiles: { fileName: string; base64: string; mediaType: string }[] = [];

    if (filesData && filesData.length > 0) {
      const textFiles = filesData.filter(
        (f) => !f.content.startsWith("data:image/")
      );
      const imgFiles = filesData.filter(
        (f) => f.content.startsWith("data:image/")
      );

      if (textFiles.length > 0) {
        filesContext = "\n### Uploaded Files\n";
        for (const f of textFiles) {
          // Truncate very large files to avoid exceeding context limits
          const truncated = f.content.length > 10000
            ? f.content.slice(0, 10000) + "\n\n[...file truncated at 10,000 characters]"
            : f.content;
          filesContext += `\n**${f.file_name}** (${f.file_type}):\n\`\`\`\n${truncated}\n\`\`\`\n`;
        }
      }

      for (const f of imgFiles) {
        // Extract base64 and media type from data URL
        const match = f.content.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          imageFiles.push({
            fileName: f.file_name,
            base64: match[2],
            mediaType: match[1],
          });
        }
      }
    }

    // Load improvement journal (user-authored entries) + edit log count
    const { data: journalData } = await supabase
      .from("improvement_journal")
      .select("title, description, status, created_at")
      .eq("process_id", processId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { count: editLogCount } = await supabase
      .from("process_improvements")
      .select("id", { count: "exact", head: true })
      .eq("process_id", processId);

    let improvementsContext = "";
    if (journalData && journalData.length > 0) {
      improvementsContext = "\n### Improvement Journal\n";
      for (const j of journalData) {
        const date = new Date(j.created_at).toLocaleDateString();
        improvementsContext += `- **${j.title}** (${j.status === "completed" ? "completed" : "in progress"}) — ${date}\n`;
        if (j.description) improvementsContext += `  ${j.description}\n`;
      }
    }
    if (editLogCount && editLogCount >= 3 && (!journalData || journalData.length === 0)) {
      improvementsContext += "\n*Note: This process has " + editLogCount + " edits in the edit log but no entries in the Improvement Journal. Consider nudging the user to record what they've actually improved.*\n";
    }

    // Load process tasks for AI context (excludes pending AI suggestions)
    const { data: taskRows } = await supabase
      .from("process_tasks")
      .select("title, description, status, pdca_section, adli_dimension, assignee_name, due_date, completed, origin, asana_section_name, priority")
      .eq("process_id", processId)
      .neq("status", "pending")
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true });

    const taskContext = buildTaskContext((taskRows || []) as TaskContextRow[]);

    // Load survey data for this process — batch queries to avoid N+1
    const { data: surveysRaw } = await supabase
      .from("surveys")
      .select("id, title")
      .eq("process_id", processId);

    const surveyContextData: SurveyContextData[] = [];

    if (surveysRaw && surveysRaw.length > 0) {
      const surveyIds = surveysRaw.map((s) => s.id);

      // Batch: fetch all questions, waves, responses, and answers in parallel
      const [questionsResult, wavesResult] = await Promise.all([
        supabase
          .from("survey_questions")
          .select("id, survey_id, question_text, question_type, sort_order")
          .in("survey_id", surveyIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("survey_waves")
          .select("id, survey_id, wave_number, status, response_count")
          .in("survey_id", surveyIds)
          .order("wave_number", { ascending: false }),
      ]);

      const allQuestions = questionsResult.data || [];
      const allWaves = wavesResult.data || [];

      // Group questions by survey
      const questionsBySurvey = new Map<number, typeof allQuestions>();
      for (const q of allQuestions) {
        const list = questionsBySurvey.get(q.survey_id) || [];
        list.push(q);
        questionsBySurvey.set(q.survey_id, list);
      }

      // Find latest wave per survey
      const latestWaveBySurvey = new Map<number, (typeof allWaves)[0]>();
      for (const w of allWaves) {
        if (!latestWaveBySurvey.has(w.survey_id)) {
          latestWaveBySurvey.set(w.survey_id, w);
        }
      }

      // Collect wave IDs that have responses for a single batch fetch
      const wavesWithResponses = [...latestWaveBySurvey.values()].filter((w) => w.response_count > 0);
      const waveIds = wavesWithResponses.map((w) => w.id);

      // Fetch responses + answers in parallel (if any waves have responses)
      let allAnswers: { response_id: number; question_id: number; value_numeric: number | null; wave_id?: number }[] = [];
      let responsesByWave = new Map<number, number[]>();

      if (waveIds.length > 0) {
        const { data: responses } = await supabase
          .from("survey_responses")
          .select("id, wave_id")
          .in("wave_id", waveIds);

        if (responses && responses.length > 0) {
          // Group response IDs by wave
          for (const r of responses) {
            const list = responsesByWave.get(r.wave_id) || [];
            list.push(r.id);
            responsesByWave.set(r.wave_id, list);
          }

          const allResponseIds = responses.map((r) => r.id);
          const { data: answersData } = await supabase
            .from("survey_answers")
            .select("response_id, question_id, value_numeric")
            .in("response_id", allResponseIds);

          allAnswers = answersData || [];
        }
      }

      // Build answer lookup: question_id → numeric values (for the latest wave's responses)
      for (const s of surveysRaw) {
        const questions = questionsBySurvey.get(s.id) || [];
        const latestWave = latestWaveBySurvey.get(s.id) || null;

        let results: SurveyContextData["results"] = [];

        if (latestWave && latestWave.response_count > 0) {
          const waveResponseIds = new Set(responsesByWave.get(latestWave.id) || []);

          // Filter answers to only this wave's responses
          const waveAnswers = allAnswers.filter((a) => waveResponseIds.has(a.response_id));

          results = questions.map((q) => {
            const qAnswers = waveAnswers
              .filter((a) => a.question_id === q.id && a.value_numeric !== null)
              .map((a) => a.value_numeric as number);
            const avg = qAnswers.length > 0
              ? qAnswers.reduce((sum, v) => sum + v, 0) / qAnswers.length
              : 0;
            return {
              question_text: q.question_text,
              question_type: q.question_type,
              avg_value: avg,
              response_count: qAnswers.length,
            };
          });
        }

        surveyContextData.push({
          title: s.title,
          question_count: questions.length,
          latest_wave: latestWave,
          results,
        });
      }
    }

    const surveyContext = buildSurveyContext(surveyContextData);

    // Build Asana context if raw data exists
    let asanaContext = "";
    const rawAsana = procData.asana_raw_data as Record<string, unknown> | null;
    if (rawAsana) {
      asanaContext = "\n### Asana Project Data\n";
      const proj = rawAsana.project as Record<string, unknown> | undefined;
      if (proj) {
        if (proj.name) asanaContext += `**Project:** ${proj.name}\n`;
        if (proj.start_on) asanaContext += `**Start:** ${proj.start_on}\n`;
        if (proj.due_on) asanaContext += `**Due:** ${proj.due_on}\n`;
        const owner = proj.owner as Record<string, unknown> | undefined;
        if (owner?.name) asanaContext += `**Owner:** ${owner.name}\n`;
      }
      const sections = rawAsana.sections as { name: string; tasks: { name: string; completed: boolean; assignee: string | null; due_on: string | null; notes: string; subtasks?: { name: string; completed: boolean; assignee: string | null; due_on: string | null }[] }[] }[] | undefined;
      if (sections) {
        let charCount = 0;
        const MAX_ASANA_CHARS = 3000;
        for (const section of sections) {
          if (charCount > MAX_ASANA_CHARS) {
            asanaContext += "\n*[Asana data truncated for context limits]*\n";
            break;
          }
          if (!section.name || section.name === "(no section)") continue;
          const completed = section.tasks.filter((t) => t.completed).length;
          const totalSubs = section.tasks.reduce((n, t) => n + (t.subtasks?.length || 0), 0);
          asanaContext += `\n**${section.name}** (${completed}/${section.tasks.length} done${totalSubs ? `, ${totalSubs} subtasks` : ""})\n`;
          for (const task of section.tasks.slice(0, 8)) {
            const status = task.completed ? "done" : "open";
            const assignee = task.assignee ? ` [${task.assignee}]` : "";
            const subCount = task.subtasks?.length ? ` (${task.subtasks.length} subtasks)` : "";
            const line = `- ${task.name} (${status}${assignee}${subCount})\n`;
            asanaContext += line;
            charCount += line.length;
          }
          if (section.tasks.length > 8) {
            asanaContext += `  ...and ${section.tasks.length - 8} more tasks\n`;
          }
        }
      }
    }

    // Build snapshot comparison context (changes since last Asana refresh)
    let snapshotContext = "";
    const prevRaw = procData.asana_raw_data_previous as Record<string, unknown> | null;
    if (rawAsana && prevRaw) {
      snapshotContext = "\n### Changes Since Last Asana Refresh\n";
      const prevSections = (prevRaw.sections || []) as { name: string; tasks: { name: string; completed: boolean }[] }[];
      const currSections = (rawAsana.sections || []) as { name: string; tasks: { name: string; completed: boolean }[] }[];

      // Build maps of section → { total, completed } for prev and curr
      const prevCounts = new Map<string, { total: number; completed: number }>();
      for (const s of prevSections) {
        if (!s.name || s.name === "(no section)") continue;
        prevCounts.set(s.name, {
          total: s.tasks.length,
          completed: s.tasks.filter((t) => t.completed).length,
        });
      }

      let hasChanges = false;
      for (const s of currSections) {
        if (!s.name || s.name === "(no section)") continue;
        const prev = prevCounts.get(s.name);
        const currCompleted = s.tasks.filter((t) => t.completed).length;

        if (!prev) {
          snapshotContext += `- **${s.name}**: New section (${s.tasks.length} tasks)\n`;
          hasChanges = true;
        } else {
          const newCompleted = currCompleted - prev.completed;
          const newTasks = s.tasks.length - prev.total;
          const changes: string[] = [];
          if (newCompleted > 0) changes.push(`${newCompleted} tasks completed`);
          if (newTasks > 0) changes.push(`${newTasks} new tasks added`);
          if (newTasks < 0) changes.push(`${Math.abs(newTasks)} tasks removed`);
          if (changes.length > 0) {
            snapshotContext += `- **${s.name}**: ${changes.join(", ")} (${currCompleted}/${s.tasks.length} done)\n`;
            hasChanges = true;
          }
        }
      }

      if (!hasChanges) {
        snapshotContext += "No significant changes detected since last refresh.\n";
      }

      const prevFetched = prevRaw.fetched_at as string | undefined;
      const currFetched = (rawAsana.fetched_at as string) || "";
      if (prevFetched) {
        snapshotContext += `\n*Previous refresh: ${new Date(prevFetched).toLocaleDateString()} → Current: ${currFetched ? new Date(currFetched).toLocaleDateString() : "now"}*\n`;
      }
    }

    // Build the full context for Claude
    const processContext = buildProcessContext(procData);
    const metricsContext = buildMetricsContext(metricsWithValues);
    const availableMetricsContext = buildAvailableMetricsContext(availableMetrics);
    const requirementsContext = buildRequirementsContext(requirements);
    const strategicObjectivesContext = buildStrategicObjectivesContext(strategicObjectives);

    // ── Block 1: Static coaching instructions (CACHED) ──────────────────────
    // SYSTEM_PROMPT is ~6K tokens of unchanging coaching rules. Marking with
    // cache_control tells Anthropic to store this prefix. Subsequent calls
    // within 5 minutes pay only 10% of normal input token cost (~90% savings).
    // Block 2: Per-process context (NOT CACHED) — changes every call.
    const systemBlocks = [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
      {
        type: "text" as const,
        text: `---

## Current Process Data

${processContext}
${metricsContext}
${availableMetricsContext}
${requirementsContext}
${strategicObjectivesContext}
${surveyContext}
${improvementsContext}
${taskContext}
${asanaContext}
${snapshotContext}
${filesContext}`,
      },
    ];

    // Stream the response from Claude word-by-word
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Build messages, injecting images into the first user message if any
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const builtMessages: any[] = messages.map((m: { role: string; content: string }, idx: number) => {
            if (idx === 0 && m.role === "user" && imageFiles.length > 0) {
              // Include uploaded images in the first user message via Claude vision
              const content: any[] = [];
              for (const img of imageFiles) {
                content.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: img.mediaType,
                    data: img.base64,
                  },
                });
              }
              content.push({ type: "text", text: m.content });
              return { role: m.role, content };
            }
            return { role: m.role, content: m.content };
          });
          /* eslint-enable @typescript-eslint/no-explicit-any */

          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemBlocks,
            messages: builtMessages,
          });

          stream.on("text", (text) => {
            controller.enqueue(encoder.encode(text));
          });

          stream.on("error", (error) => {
            console.error("Anthropic stream error:", error);
            // Send error message as final chunk so user sees something useful
            const errMsg = "\n\n*Connection to AI was interrupted. Please try again or simplify your request.*";
            controller.enqueue(encoder.encode(errMsg));
            controller.close();
          });

          await stream.finalMessage();
          controller.close();
        } catch (err) {
          console.error("Stream setup error:", err);
          // Try to send a useful error message as the stream content
          try {
            const errMsg = "\n\n*AI request failed. Please try again.*";
            controller.enqueue(encoder.encode(errMsg));
            controller.close();
          } catch {
            controller.error(err);
          }
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no", // Disable proxy buffering (nginx, Vercel edge)
        "Cache-Control": "no-cache, no-transform", // Prevent CDN from holding chunks
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return Response.json(
      { error: "Failed to process AI request" },
      { status: 500 }
    );
  }
}
