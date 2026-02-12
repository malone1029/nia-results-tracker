import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import { buildHelpSystemPrompt } from "@/lib/help-ai-context";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rateLimitResult = await checkRateLimit(user.id);
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const { messages, pageUrl } = await request.json();

  // Check admin status for context
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  const isAdmin = roleRow?.role === "admin";

  const systemPrompt = buildHelpSystemPrompt(pageUrl || "/", isAdmin);

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  // Stream response
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
        console.error("AI help stream error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
