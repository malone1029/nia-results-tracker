import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { NIA_ORG_PROFILE, BALDRIGE_CATEGORIES } from "@/app/api/admin/generate-workflow/route";
import type { GapItem } from "@/app/api/admin/generate-workflow/route";

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
 * POST /api/admin/workflow-chat
 * Streaming chat about the current Mission Workflow Diagram.
 * Receives the current mermaid code, gaps, and process list so the AI
 * can answer specific questions about the diagram. Super admin only.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!isSuperAdminRole(roleData?.role || "")) {
    return new Response("Super admin access required", { status: 403 });
  }

  const { messages, mermaid, gaps, processList } = await request.json() as {
    messages: ChatMessage[];
    mermaid: string;
    gaps: GapItem[];
    processList: string;
  };

  // Build a plain-text summary of which categories have processes
  const categoryContext = BALDRIGE_CATEGORIES
    .filter((c) => c.number <= 6)
    .map((c) => {
      const gapsInCat = gaps.filter((g) => g.baldrigeCategory === c.number);
      return `Category ${c.number} (${c.name}): ${c.description}${gapsInCat.length > 0 ? ` — ${gapsInCat.length} gap(s) identified: ${gapsInCat.map((g) => g.name).join(", ")}` : ""}`;
    })
    .join("\n");

  const gapContext = gaps.length > 0
    ? gaps.map((g) =>
        `- [${g.priority.toUpperCase()}] ${g.name} (Baldrige ${g.baldrigeItem}, Cat ${g.baldrigeCategory}): ${g.rationale}`
      ).join("\n")
    : "No gaps identified yet.";

  const systemPrompt = `You are a Baldrige Excellence Framework expert advising NIA (Northwestern Illinois Association), a governmental special education cooperative.

You are currently discussing NIA's Mission Workflow Diagram — a Mermaid flowchart that maps NIA's documented key processes to the 6 Baldrige Systems Model categories, color-coded by ADLI maturity.

${NIA_ORG_PROFILE}

CURRENT DIAGRAM STATE:
Mermaid code (for reference — do not repeat it back):
\`\`\`
${mermaid || "(No diagram generated yet)"}
\`\`\`

BALDRIGE CATEGORY SUMMARY:
${categoryContext}

IDENTIFIED GAPS (processes NIA likely needs but hasn't documented yet):
${gapContext}

CURRENT KEY PROCESSES:
${processList || "(none available)"}

INSTRUCTIONS:
- Answer questions about the diagram, specific categories, gaps, and process maturity with specific references to process names, Baldrige items, and NIA's organizational context.
- When asked "why is Category X empty?", explain what types of processes belong in that category and suggest 2-3 concrete process names NIA should document based on its services and challenges.
- When recommending what to build first, prioritize based on: (1) strategic impact for NIA's mission, (2) high priority gaps, (3) processes where NIA clearly has operational activity but no documentation.
- Be specific and actionable. Reference actual NIA service areas (OT, PT, SLP, DHH, etc.) and challenges (workforce shortage, customer retention) when relevant.
- Keep responses concise — 150–300 words unless the user asks for more detail.`;

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
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        console.error("workflow-chat stream error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
