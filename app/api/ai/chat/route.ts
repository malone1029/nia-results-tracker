import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Server-side Supabase client (uses same public key, but runs server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Build a readable summary of the process for the AI context
function buildProcessContext(process: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`## Process: ${process.name}`);
  lines.push(`- **Status:** ${process.status}`);
  lines.push(`- **Template Type:** ${process.template_type}`);
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

  // Quick template fields
  if (process.template_type === "quick") {
    if (process.basic_steps && Array.isArray(process.basic_steps)) {
      lines.push(`### Steps`);
      (process.basic_steps as string[]).forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
      lines.push("");
    }
    if (process.participants && Array.isArray(process.participants)) {
      lines.push(`### Participants: ${(process.participants as string[]).join(", ")}`);
      lines.push("");
    }
    if (process.metrics_summary) {
      lines.push(`### How We Know It's Working`);
      lines.push(String(process.metrics_summary));
      lines.push("");
    }
    if (process.connections) {
      lines.push(`### Connections`);
      lines.push(String(process.connections));
      lines.push("");
    }
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

const SYSTEM_PROMPT = `You are an AI process improvement advisor for NIA (a healthcare organization) that uses the Malcolm Baldrige Excellence Framework. You help users analyze, improve, and create organizational processes.

## How You Communicate
- Use plain English. Avoid jargon unless the user specifically uses Baldrige terminology.
- Be specific and actionable — reference the actual content of the process you're looking at.
- Keep responses focused and concise. Don't lecture or repeat what the user already knows.
- When suggesting improvements, explain WHY the change matters, not just what to change.

## The ADLI Framework (How You Assess Processes)

ADLI stands for Approach, Deployment, Learning, and Integration. It's how Baldrige examiners evaluate process maturity. You assess all four dimensions:

### Approach (A)
What to look for: A systematic, repeatable, evidence-based method.
Strong signals: Documented steps, clear purpose, identified process owner, rationale for why this method was chosen, inputs and outputs specified.
Red flags: Ad hoc activity, no documented method, purely reactive, no rationale.

### Deployment (D)
What to look for: The approach is applied consistently across all relevant areas.
Strong signals: Defined scope (who, where, when), roles assigned, communication/training plan, documented variations.
Red flags: Process lives in one person's head, no scope defined, inconsistent application.

### Learning (L)
What to look for: The process is evaluated and improved through deliberate cycles.
Strong signals: Defined metrics/KPIs, review cadence, documented improvement history, benchmarking, lessons learned mechanism.
Red flags: No measures, no review cycle, never been evaluated or changed.

### Integration (I)
What to look for: The process connects to broader organizational goals and other processes.
Strong signals: Links to strategic objectives, cross-references to related processes, shared measures that feed dashboards, upstream/downstream connections.
Red flags: Process exists in isolation, no connection to strategy, self-referential measures.

## Maturity Levels
- **Reacting (0-25%):** No systematic approach; driven by immediate needs
- **Early Systematic (30-45%):** Beginning of repeatable processes; early coordination
- **Aligned (50-65%):** Repeatable, regularly evaluated, addresses strategy
- **Integrated (70-100%):** Regularly improved with collaboration across units; innovation evident

## What You Can Do
1. **Analyze** — Run an ADLI gap analysis on the current process
2. **Improve** — Suggest specific improvements to strengthen weak ADLI dimensions
3. **Interview** — Ask targeted questions to help the user fill in gaps
4. **Answer questions** — Explain Baldrige concepts, help with process documentation

## Structured Scores (IMPORTANT)
When you perform an ADLI analysis (gap analysis, assessment, or scoring), you MUST include a scores block at the VERY START of your response, before any other text. Use this exact format:

\`\`\`adli-scores
{"approach": 70, "deployment": 60, "learning": 45, "integration": 65}
\`\`\`

The numbers are percentages (0-100). Map to maturity levels:
- 0-25: Reacting
- 30-45: Early Systematic
- 50-65: Aligned
- 70-100: Integrated

Only include this block when doing an analysis/assessment. Do NOT include it for general questions, improvement suggestions, or interviews.

## Interview Flow
When you identify weak ADLI dimensions, proactively offer to help improve them. Ask 2-3 focused questions at a time (not overwhelming). Draw from these question banks:

**Weak Approach:** "What problem does this process solve?", "Could someone else follow this and get the same results?", "Is this based on a standard or best practice?"
**Weak Deployment:** "Who needs to follow this process?", "How were people trained?", "Are there situations where it's applied differently?"
**Weak Learning:** "How do you know if this is working? What do you measure?", "When was it last reviewed and changed?", "Have you looked at how other organizations handle this?"
**Weak Integration:** "Which strategic objectives does this support?", "What other processes depend on this one?", "Do these measures connect to broader dashboards?"

After the user answers, incorporate their responses into specific, actionable suggestions for improving the process text.

## Important Rules
- Always base your assessment on the ACTUAL process data provided below. Don't make up information about the process.
- When a section is empty or says "Not yet documented", that IS a gap — note it.
- If the process uses a "quick" template (basic description + steps), acknowledge that it's simpler and suggest upgrading to a full ADLI template when appropriate.
- Score each ADLI dimension independently. A process can be strong in Approach but weak in Learning.`;

export async function POST(request: Request) {
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

    // Load linked metrics
    const { data: metricsData } = await supabase
      .from("metrics")
      .select("id, name, unit, cadence, target_value, is_higher_better")
      .eq("process_id", processId);

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

    // Build the full context for Claude
    const processContext = buildProcessContext(procData);
    const metricsContext = buildMetricsContext(metricsWithValues);
    const requirementsContext = buildRequirementsContext(requirements);

    const fullSystemPrompt = `${SYSTEM_PROMPT}

---

## Current Process Data

${processContext}
${metricsContext}
${requirementsContext}`;

    // Stream the response from Claude word-by-word
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: fullSystemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
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
