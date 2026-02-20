import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import type { ProcessMapFlowData } from "@/lib/flow-types";
import type { Charter } from "@/lib/types";

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * POST /api/ai/map-chat
 * Streaming chat for editing an individual process map.
 * Returns text + optional ---DIAGRAM--- JSON when the AI edits the map.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, flowData, processId, processName, charter } =
    (await request.json()) as {
      messages: ChatMessage[];
      flowData: ProcessMapFlowData | null;
      processId: number;
      processName: string;
      charter: Charter | null;
    };

  // Build a compact charter summary to give the AI context
  const charterSummary = charter
    ? [
        charter.purpose && `Purpose: ${charter.purpose}`,
        charter.scope_includes && `Scope: ${charter.scope_includes}`,
        charter.stakeholders?.length && `Stakeholders: ${charter.stakeholders.join(", ")}`,
        charter.content && !charter.purpose && `Content: ${charter.content.slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "(No charter available)";

  const nodeSummary = flowData
    ? flowData.nodes
        .map(
          (n) =>
            `${n.id} [${n.type}] "${n.label}"${n.responsible ? ` (${n.responsible})` : ""}`
        )
        .join(", ")
    : "(No diagram yet)";

  const edgeSummary = flowData
    ? flowData.edges
        .map((e) => `${e.source}→${e.target}${e.label ? ` (${e.label})` : ""}`)
        .join(", ")
    : "";

  const systemPrompt = `You are a process improvement specialist helping NIA (Northwestern Illinois Association), a governmental special education cooperative, document and refine their process maps.

You are editing the process map for: "${processName}"

CHARTER SUMMARY:
${charterSummary}

CURRENT PROCESS MAP:
Nodes: ${nodeSummary}
Connections: ${edgeSummary || "(none)"}

INSTRUCTIONS:
- Answer questions about this specific process map — its steps, logic, responsible parties, and connections.
- When asked to add steps, rename nodes, change connections, or restructure the flow, update the diagram.
- Keep responses concise — 100–250 words unless the user asks for more.
- Be specific and practical. Reference actual steps from the charter when suggesting map improvements.

DIAGRAM EDITING:
When modifying the diagram, write your explanation first, then append exactly:
---DIAGRAM---
{"nodes": [...complete updated nodes...], "edges": [...complete updated edges...]}

Node rules:
- Always return the COMPLETE nodes and edges arrays (not just changed parts)
- Each node must have: id (string), type ("start"|"end"|"step"|"decision"|"input"|"output"), label (≤40 chars)
- Optional on nodes: responsible (string), notes (string)
- One "start" node required, at least one "end" node required
- Use simple IDs: s1, s2, d1, d2, in1, out1, end1 — or keep existing IDs when preserving nodes

Edge rules:
- Each edge must have: id (string), source (string), target (string)
- Decision node edges should use label: "Yes" or "No"
- New edge IDs: use e1, e2, e3... or keep existing IDs

Only append ---DIAGRAM--- when actually modifying the diagram. For questions, respond with text only.`;

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("map-chat stream error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
