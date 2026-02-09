import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import { ADLI_TO_PDCA_PROMPT } from "@/lib/pdca";

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
  if (process.is_key) lines.push(`- **Key Process:** Yes`);
  if (process.guided_step) lines.push(`- **Guided Step:** ${process.guided_step}`);
  lines.push("");

  if (process.description) {
    lines.push(`### Description`);
    lines.push(String(process.description));
    lines.push("");
  }

  // Charter
  const charter = process.charter as Record<string, unknown> | null;
  if (charter) {
    lines.push(`### Charter`);
    if (charter.content) {
      lines.push(String(charter.content));
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
        lines.push(String(data.content));
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

  // Baldrige Connections
  const bc = process.baldrige_connections as Record<string, unknown> | null;
  if (bc) {
    lines.push(`### Baldrige Connections`);
    if (bc.content) {
      lines.push(String(bc.content));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildMetricsContext(metrics: Record<string, unknown>[]): string {
  if (metrics.length === 0) return "\n### Linked Metrics\nNo metrics linked to this process yet.\n";

  const lines = ["\n### Linked Metrics"];
  for (const m of metrics) {
    lines.push(`- **${m.name}** (${m.cadence}): ${m.last_value !== null ? `${m.last_value} ${m.unit}` : "No data yet"}`);
    if (m.target_value !== null) {
      lines.push(`  Target: ${m.target_value} ${m.unit}`);
    }
  }
  return lines.join("\n") + "\n";
}

function buildRequirementsContext(requirements: Record<string, unknown>[]): string {
  if (requirements.length === 0) return "\n### Linked Key Requirements\nNo key requirements linked yet.\n";

  const lines = ["\n### Linked Key Requirements"];
  for (const r of requirements) {
    lines.push(`- **${r.requirement}** (${r.stakeholder_group})`);
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

## The ADLI Framework

ADLI = Approach, Deployment, Learning, Integration. It's how Baldrige evaluates process maturity.

- **Approach:** Is there a systematic, repeatable method? (Evidence-based, documented, rationale)
- **Deployment:** Is it applied consistently? (Scope defined, roles clear, training exists)
- **Learning:** Is it measured and improved? (Metrics, review cycles, documented changes)
- **Integration:** Does it connect to strategy? (Links to goals, related processes, shared measures)

Maturity levels: Reacting (0-25%), Early Systematic (30-45%), Aligned (50-65%), Integrated (70-100%)

## How to Coach

1. **Start with the weakest dimension** — focus your energy where it'll make the most difference
2. **Check improvement history** — if something was already improved recently, move to the next gap. Don't suggest what's already been done.
3. **Offer 2-3 actionable options** with effort levels, not a comprehensive audit
4. **Ask questions** when you need more info — 2-3 at a time, focused on the weakest area

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
        "adliDimension": "learning"
      },
      {
        "title": "Schedule first quarterly review meeting",
        "description": "Set up a recurring quarterly review meeting with all process stakeholders.",
        "pdcaSection": "evaluate",
        "adliDimension": "learning"
      }
    ]
  }
]
\`\`\`

Field values for "field": "charter", "adli_approach", "adli_deployment", "adli_learning", "adli_integration"
Priority values: "quick-win" (easy, high impact), "important" (medium effort, high impact), "long-term" (significant effort)
Effort values: "minimal" (< 30 min), "moderate" (1-2 hours), "substantial" (half day+)
Task pdcaSection values: "plan", "execute", "evaluate", "improve"
Task adliDimension values: "approach", "deployment", "learning", "integration"

Rules for suggestions:
- Maximum 3 suggestions per response
- Each "content" must be complete, standalone markdown — not a diff
- Focus on the weakest dimension first
- Include effort estimates to help users prioritize
- If the improvement history shows something was recently addressed in a dimension, skip it and focus elsewhere
- **Each suggestion MUST include a "tasks" array** with 1-5 concrete, assignable tasks
- Tasks should be spread across at least 1-2 PDCA sections (use the mapping rules below)
- Each task title should be action-oriented and specific (e.g., "Train nursing staff on new intake form" not "Do training")

Only include this block when you are proposing specific improvements. Do NOT include it for general questions or task-building interviews.

${ADLI_TO_PDCA_PROMPT}

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
    "adliDimension": "approach"
  },
  {
    "title": "Train front-desk staff on new intake form",
    "description": "Schedule and deliver a 30-minute training session covering the updated intake form and common questions.",
    "pdcaSection": "execute",
    "adliDimension": "deployment"
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

When you see the charter or any ADLI section containing task lists or operational items (e.g., "- Send calendar invite", "- Order supplies", "- Review document"), this is misplaced content. Process documentation should describe HOW the process works, not list tasks to do.

When you detect this:
1. Point out that the section contains operational tasks mixed with process documentation
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
- **assessment** → Run an ADLI gap analysis with scores. Identify the weakest dimensions
- **deep_dive** → Focus on the weakest dimension. Offer specific improvements with tasks
- **tasks** → Help build a task list (interview mode). Suggest reviewing and exporting when done
- **export** → Remind them to export to Asana. After that, work in Asana until next refresh
- **complete** → Celebrate progress! Suggest refreshing from Asana when they're ready for the next cycle

Don't force the flow — if the user asks about something else, help them. But gently nudge toward the next step when appropriate.

## Important Rules
- Base your assessment on the ACTUAL process data provided below. Don't make up information.
- When a section is empty, that IS a gap — note it.
- Score each ADLI dimension independently.
- Check the Improvement History section to avoid suggesting changes that were already made.`;

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
        .select("metric_id, value")
        .in("metric_id", metricsData.map((m) => m.id))
        .order("date", { ascending: false });

      const latestByMetric = new Map<number, number>();
      if (entries) {
        for (const e of entries) {
          if (!latestByMetric.has(e.metric_id)) {
            latestByMetric.set(e.metric_id, e.value);
          }
        }
      }

      metricsWithValues = metricsData.map((m) => ({
        ...m,
        last_value: latestByMetric.get(m.id) ?? null,
      }));
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

    // Load improvement history (last 10 entries)
    const { data: improvementsData } = await supabase
      .from("process_improvements")
      .select("title, section_affected, change_type, status, source, committed_date, description")
      .eq("process_id", processId)
      .order("committed_date", { ascending: false })
      .limit(10);

    let improvementsContext = "";
    if (improvementsData && improvementsData.length > 0) {
      improvementsContext = "\n### Improvement History\n";
      for (const imp of improvementsData) {
        const date = new Date(imp.committed_date).toLocaleDateString();
        improvementsContext += `- **${imp.title}** (${imp.section_affected}, ${imp.status}) — ${date}\n`;
        if (imp.description) improvementsContext += `  ${imp.description}\n`;
      }
    }

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
        const MAX_ASANA_CHARS = 5000; // Increased to accommodate subtask data
        for (const section of sections) {
          if (charCount > MAX_ASANA_CHARS) {
            asanaContext += "\n*[Asana data truncated for context limits]*\n";
            break;
          }
          if (!section.name || section.name === "(no section)") continue;
          const completed = section.tasks.filter((t) => t.completed).length;
          asanaContext += `\n**${section.name}** (${completed}/${section.tasks.length} done)\n`;
          for (const task of section.tasks.slice(0, 15)) {
            const status = task.completed ? "done" : "open";
            const assignee = task.assignee ? ` [${task.assignee}]` : "";
            const due = task.due_on ? ` due ${task.due_on}` : "";
            const line = `- ${task.name} (${status}${assignee}${due})\n`;
            asanaContext += line;
            charCount += line.length;
            // Show subtasks indented under parent
            if (task.subtasks && task.subtasks.length > 0) {
              for (const sub of task.subtasks) {
                const subStatus = sub.completed ? "done" : "open";
                const subAssignee = sub.assignee ? ` [${sub.assignee}]` : "";
                const subDue = sub.due_on ? ` due ${sub.due_on}` : "";
                const subLine = `  - ${sub.name} (${subStatus}${subAssignee}${subDue})\n`;
                asanaContext += subLine;
                charCount += subLine.length;
              }
            }
          }
          if (section.tasks.length > 15) {
            asanaContext += `  ...and ${section.tasks.length - 15} more tasks\n`;
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
    const requirementsContext = buildRequirementsContext(requirements);

    const fullSystemPrompt = `${SYSTEM_PROMPT}

---

## Current Process Data

${processContext}
${metricsContext}
${requirementsContext}
${improvementsContext}
${asanaContext}
${snapshotContext}
${filesContext}`;

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
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: fullSystemPrompt,
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
