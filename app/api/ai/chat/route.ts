import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
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
    "content": "The full improved markdown content for the section goes here. Write the COMPLETE section, incorporating what exists PLUS your improvements."
  }
]
\`\`\`

Field values for "field": "charter", "adli_approach", "adli_deployment", "adli_learning", "adli_integration"
Priority values: "quick-win" (easy, high impact), "important" (medium effort, high impact), "long-term" (significant effort)
Effort values: "minimal" (< 30 min), "moderate" (1-2 hours), "substantial" (half day+)

Rules for suggestions:
- Maximum 3 suggestions per response
- Each "content" must be complete, standalone markdown — not a diff
- Focus on the weakest dimension first
- Include effort estimates to help users prioritize
- If the improvement history shows something was recently addressed in a dimension, skip it and focus elsewhere

Only include this block when you are proposing specific improvements. Do NOT include it for general questions or interviews.

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
      const sections = rawAsana.sections as { name: string; tasks: { name: string; completed: boolean; assignee: string | null; due_on: string | null; notes: string }[] }[] | undefined;
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
          asanaContext += `\n**${section.name}** (${completed}/${section.tasks.length} done)\n`;
          for (const task of section.tasks.slice(0, 10)) {
            const status = task.completed ? "done" : "open";
            const assignee = task.assignee ? ` [${task.assignee}]` : "";
            const due = task.due_on ? ` due ${task.due_on}` : "";
            const line = `- ${task.name} (${status}${assignee}${due})\n`;
            asanaContext += line;
            charCount += line.length;
          }
          if (section.tasks.length > 10) {
            asanaContext += `  ...and ${section.tasks.length - 10} more tasks\n`;
          }
        }
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

          await stream.finalMessage();
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
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
