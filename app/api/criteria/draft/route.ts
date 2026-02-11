import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000,
  maxRetries: 0,
});

// Total word budget for a 25-page Baldrige application (~500 words/page)
const TOTAL_WORD_BUDGET = 12500;
// Total points across all draftable items (Categories 1-6 process items)
const DRAFTABLE_TOTAL_POINTS = 550; // 1.1(70)+1.2(50)+2.1(40)+2.2(45)+3.1(40)+3.2(45)+4.1(45)+4.2(25)+5.1(40)+5.2(40)+6.1(45)+6.2(40)+6.3(25)

/**
 * Build a rich context string for a "primary" mapped process.
 * Includes charter + full ADLI sections, capped to ~4500 chars.
 */
function buildPrimaryContext(proc: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`### Process: ${proc.name}`);
  if (proc.owner) lines.push(`Owner: ${proc.owner}`);
  if (proc.description) lines.push(`Description: ${String(proc.description).slice(0, 300)}`);

  const charter = proc.charter as Record<string, unknown> | null;
  if (charter?.content) {
    const text = String(charter.content);
    lines.push(`\n**Charter:**\n${text.slice(0, 1500)}`);
  }

  for (const dim of ["adli_approach", "adli_deployment", "adli_learning", "adli_integration"]) {
    const data = proc[dim] as Record<string, unknown> | null;
    if (data?.content) {
      const label = dim.replace("adli_", "").replace(/^\w/, (c) => c.toUpperCase());
      const text = String(data.content);
      lines.push(`\n**${label}:**\n${text.slice(0, 700)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build a condensed context for "supporting" or "partial" mapped processes.
 */
function buildSupportingContext(proc: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`### Process: ${proc.name}`);
  if (proc.owner) lines.push(`Owner: ${proc.owner}`);

  const charter = proc.charter as Record<string, unknown> | null;
  if (charter?.content) {
    lines.push(`Charter summary: ${String(charter.content).slice(0, 400)}`);
  }

  for (const dim of ["adli_approach", "adli_deployment", "adli_learning", "adli_integration"]) {
    const data = proc[dim] as Record<string, unknown> | null;
    if (data?.content) {
      const label = dim.replace("adli_", "").replace(/^\w/, (c) => c.toUpperCase());
      lines.push(`${label}: ${String(data.content).slice(0, 150)}`);
    }
  }

  return lines.join("\n");
}

/**
 * POST /api/criteria/draft
 * Streams an AI-generated narrative draft for a Baldrige item.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Admin check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (roleData?.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  // Rate limit check
  const rl = await checkRateLimit(user.id);
  if (!rl.success) return rl.response;

  const body = await request.json();
  const { item_id, tier = "excellence_builder" } = body;

  if (!item_id) {
    return Response.json({ error: "item_id is required" }, { status: 400 });
  }

  try {
    // Fetch item details with questions (filtered by tier)
    let questionsQuery = supabase
      .from("baldrige_questions")
      .select("*")
      .eq("item_id", item_id)
      .order("sort_order");

    if (tier !== "all") {
      questionsQuery = questionsQuery.eq("tier", tier);
    }

    const [itemRes, questionsRes] = await Promise.all([
      supabase.from("baldrige_items").select("*").eq("id", item_id).single(),
      questionsQuery,
    ]);

    if (itemRes.error || !itemRes.data) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    const item = itemRes.data;

    // Block Profile and Results items
    if (item.item_type === "profile" || item.item_type === "results") {
      return Response.json(
        { error: "Draft generation is only available for Process items (Categories 1-6)" },
        { status: 400 }
      );
    }

    const questions = questionsRes.data || [];

    // Fetch mappings for all questions in this item
    const questionIds = questions.map((q: { id: number }) => q.id);
    const { data: mappings } = await supabase
      .from("process_question_mappings")
      .select("*, processes(id, name, owner, description, charter, adli_approach, adli_deployment, adli_learning, adli_integration)")
      .in("question_id", questionIds);

    // Group mappings by coverage level for context budgeting
    const primaryProcessIds = new Set<number>();
    const supportingProcessIds = new Set<number>();
    const processMap = new Map<number, Record<string, unknown>>();

    for (const m of mappings || []) {
      const proc = m.processes as unknown as Record<string, unknown>;
      if (!proc) continue;
      const pid = proc.id as number;
      processMap.set(pid, proc);

      if (m.coverage === "primary") {
        primaryProcessIds.add(pid);
      } else {
        supportingProcessIds.add(pid);
      }
    }

    // Remove any process from supporting if it's already primary
    for (const pid of primaryProcessIds) {
      supportingProcessIds.delete(pid);
    }

    // Build process context with tiered detail
    const contextParts: string[] = [];

    // Primary processes: full detail (cap at 5)
    const primaryIds = [...primaryProcessIds].slice(0, 5);
    if (primaryIds.length > 0) {
      contextParts.push("## Primary Mapped Processes (Full Detail)");
      for (const pid of primaryIds) {
        const proc = processMap.get(pid);
        if (proc) contextParts.push(buildPrimaryContext(proc));
      }
    }

    // Supporting/partial: condensed (cap at 5)
    const supportingIds = [...supportingProcessIds].slice(0, 5);
    if (supportingIds.length > 0) {
      contextParts.push("\n## Supporting/Partial Mapped Processes (Summary)");
      for (const pid of supportingIds) {
        const proc = processMap.get(pid);
        if (proc) contextParts.push(buildSupportingContext(proc));
      }
    }

    // Build question list for the prompt
    const questionList = questions
      .map((q: { question_code: string; area_label: string; question_text: string }) =>
        `- **${q.question_code}** (${q.area_label}): ${q.question_text}`
      )
      .join("\n");

    // Calculate word budget proportional to point value
    const wordBudget = Math.round(
      (item.points / DRAFTABLE_TOTAL_POINTS) * TOTAL_WORD_BUDGET
    );

    const processContext = contextParts.length > 0
      ? contextParts.join("\n\n")
      : "No processes have been mapped to this item yet. Generate a placeholder draft that marks all areas as [GAP: No process mapped].";

    const systemPrompt = `You are a Baldrige Performance Excellence expert helping NIA (Northern Illinois Academy) draft their Illinois Lincoln Award application. NIA is an educational service agency supporting 104 member districts in northern Illinois.

Your task: Write a narrative draft for Baldrige Item ${item.item_code} "${item.item_name}" (${item.category_name}, ${item.points} points).

## Writing Guidelines

1. **Structure:** Address each sub-question listed below IN ORDER. Use the area labels as section headings (e.g., "### Vision and Values").

2. **ADLI Framework:** For each sub-question, demonstrate:
   - **Approach:** What systematic methods NIA uses
   - **Deployment:** How fully the approach is implemented across the organization
   - **Learning:** How NIA evaluates and improves the approach
   - **Integration:** How the approach aligns with organizational needs and other processes

3. **Evidence-based:** Reference specific NIA processes by name. Use concrete details from the process documentation provided. Do NOT invent facts — if information is missing, mark gaps with \`[GAP: description of what's needed]\`.

4. **Tone:** Professional, third-person ("NIA" or "the organization"), confident but honest. Write as if this will appear in the actual application.

5. **Word budget:** Target approximately ${wordBudget} words (proportional to the ${item.points}-point value of this item). Quality over quantity — be concise but thorough.

6. **Format:** Use markdown. Start with a brief item overview (2-3 sentences), then address each question area.

## Questions to Address

${questionList}

## Mapped Process Evidence

${processContext}`;

    // Stream the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: `Please draft the narrative for Item ${item.item_code} "${item.item_name}". Address each sub-question using the mapped process evidence. Mark any gaps where evidence is insufficient.`,
              },
            ],
          });

          stream.on("text", (text) => {
            controller.enqueue(encoder.encode(text));
          });

          stream.on("error", (error) => {
            console.error("Anthropic stream error:", error);
            const errMsg =
              "\n\n*Connection to AI was interrupted. Please try again.*";
            controller.enqueue(encoder.encode(errMsg));
            controller.close();
          });

          await stream.finalMessage();
          controller.close();
        } catch (err) {
          console.error("Draft stream error:", err);
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
    console.error("Draft generation error:", error);
    return Response.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
