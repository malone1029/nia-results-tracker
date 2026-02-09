import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";

// Allow up to 60 seconds for AI streaming responses
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

const SYSTEM_PROMPT = `You are an AI process creation assistant for NIA (a healthcare organization) that uses the Malcolm Baldrige Excellence Framework. You help users create new organizational processes through a guided conversation.

## Your Job

Walk the user through creating a complete process document. Start simple, build progressively, and generate a full process draft when you have enough information.

## Conversation Flow

### Phase 1: The Basics (first 2-3 messages)
Start by asking these questions ONE OR TWO at a time:
1. "What process do you want to document? Give me the name and a quick description."
2. "What problem does this process solve? Why does it matter to NIA?"
3. "Who owns this process and who's involved?"

### Phase 2: How It Works (next 2-3 messages)
4. "Walk me through the steps. What happens from start to finish?"
5. "How do you know if this process is working? What do you measure?"
6. "How are people trained on this? Where is it applied?"

### Phase 3: Maturity & Connections (next 1-2 messages)
7. "When was this process last reviewed or improved? What changed?"
8. "Which NIA strategic goals does this support? What other processes connect to it?"

### Phase 4: Generate Draft
After you have answers to most of these questions, generate a complete process draft. DO NOT wait for the user to answer every single question — use your judgment. If you have enough for a solid draft, generate it.

## How You Communicate
- Use plain English. Avoid jargon.
- Ask 1-2 questions at a time (never more than 3).
- Acknowledge what the user said before asking the next question.
- If the user gives you a lot of info at once, skip questions you already have answers to.
- Be encouraging but not patronizing.

## Generating the Draft

When you have enough information, generate a complete process draft. You MUST include a structured block at the END of your response in this exact format:

\`\`\`process-draft
{
  "name": "Process Name",
  "description": "Brief description of what this process does",
  "category_suggestion": "The Baldrige category name that fits best (e.g., Leadership, Strategy, Customers, Measurement, Workforce, Operations, Results)",
  "owner": "Person or role who owns this",
  "is_key": false,
  "charter": {
    "content": "Full markdown content for the charter section. Include purpose, scope, stakeholders, and mission alignment."
  },
  "adli_approach": {
    "content": "Full markdown content describing the systematic approach. Include methodology, rationale, inputs/outputs."
  },
  "adli_deployment": {
    "content": "Full markdown content about deployment. Include scope, roles, training, communication plan."
  },
  "adli_learning": {
    "content": "Full markdown content about learning. Include metrics, review cadence, improvement history."
  },
  "adli_integration": {
    "content": "Full markdown content about integration. Include strategic objectives, related processes, shared measures."
  }
}
\`\`\`

### Rules for the draft:
- Use "full" template (charter + ADLI) — that's the point of AI creation.
- Write substantial content for each section (at least 3-4 sentences each, more is better).
- Base EVERYTHING on what the user actually told you. Don't make things up.
- Where the user didn't provide details, write reasonable placeholders in brackets like [specify the frequency] so they know what to fill in.
- The "category_suggestion" should be one of: Leadership, Strategy, Customers, Measurement Analysis and Knowledge Management, Workforce, Operations, Results.
- Set is_key to true only if the user explicitly says this is a key/critical process.

## Important
- DO NOT generate a draft in your first response. Ask questions first.
- DO NOT include the process-draft block until you're ready to generate. Only include it once.
- After generating the draft, tell the user they can review it in the preview and either save it or ask you to make changes.`;

// Load categories for mapping AI suggestion to category_id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCategoryMap(supabase: any): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("categories")
    .select("id, display_name")
    .order("sort_order");

  const map = new Map<string, number>();
  if (data) {
    for (const cat of data) {
      // Map by lowercase for flexible matching
      map.set(cat.display_name.toLowerCase(), cat.id);
    }
  }
  return map;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  try {
    const { messages, action, processData } = await request.json();

    // Handle "save" action — create the process in Supabase
    if (action === "save" && processData) {
      const categoryMap = await getCategoryMap(supabase);

      // Try to match the AI's category suggestion
      const suggestion = (processData.category_suggestion || "").toLowerCase();
      let categoryId: number | null = null;
      for (const [name, id] of categoryMap.entries()) {
        if (name.includes(suggestion) || suggestion.includes(name)) {
          categoryId = id;
          break;
        }
      }

      // If no match, use the first category as default
      if (!categoryId) {
        const firstEntry = categoryMap.entries().next().value;
        if (firstEntry) categoryId = firstEntry[1];
      }

      if (!categoryId) {
        return Response.json({ error: "No categories found" }, { status: 500 });
      }

      const { data, error } = await supabase
        .from("processes")
        .insert({
          name: processData.name,
          description: processData.description || null,
          category_id: categoryId,
          owner: processData.owner || null,
          is_key: processData.is_key || false,
          status: "draft",
          template_type: "full",
          charter: processData.charter || null,
          adli_approach: processData.adli_approach || null,
          adli_deployment: processData.adli_deployment || null,
          adli_learning: processData.adli_learning || null,
          adli_integration: processData.adli_integration || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Create process error:", error);
        return Response.json({ error: "Failed to create process" }, { status: 500 });
      }

      return Response.json({ processId: data.id });
    }

    // Handle "chat" — stream AI response
    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          });

          stream.on("text", (text) => {
            controller.enqueue(encoder.encode(text));
          });

          stream.on("error", (error) => {
            console.error("Anthropic stream error:", error);
            const errMsg = "\n\n*Connection to AI was interrupted. Please try again.*";
            controller.enqueue(encoder.encode(errMsg));
            controller.close();
          });

          await stream.finalMessage();
          controller.close();
        } catch (err) {
          console.error("Stream setup error:", err);
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
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("AI create-process error:", error);
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
