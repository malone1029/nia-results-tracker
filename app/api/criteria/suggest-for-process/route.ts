import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000,
  maxRetries: 0,
});

/**
 * POST /api/criteria/suggest-for-process
 * Given a process_id, uses AI to find matching Baldrige questions.
 * Returns suggestions for the user to accept/dismiss.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = await checkRateLimit(user.id);
  if (!rl.success) return rl.response;

  const body = await request.json();
  const processId = body.process_id;
  if (!processId) {
    return NextResponse.json({ error: "process_id required" }, { status: 400 });
  }

  // Fetch process data
  const { data: proc, error: procErr } = await supabase
    .from("processes")
    .select("id, name, description, charter, adli_approach, adli_deployment, adli_learning, adli_integration")
    .eq("id", processId)
    .single();

  if (procErr || !proc) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch all questions + existing mappings for this process
  const [questionsRes, existingRes] = await Promise.all([
    supabase.from("baldrige_questions")
      .select("id, question_code, question_text, area_label, tier, baldrige_items!inner(item_code, item_name, category_name)")
      .order("sort_order"),
    supabase.from("process_question_mappings")
      .select("question_id")
      .eq("process_id", processId),
  ]);

  if (questionsRes.error) {
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }

  // Filter to unmapped questions only
  const alreadyMapped = new Set((existingRes.data || []).map((m) => m.question_id));
  const unmappedQuestions = (questionsRes.data || []).filter(
    (q: { id: number }) => !alreadyMapped.has(q.id)
  );

  if (unmappedQuestions.length === 0) {
    return NextResponse.json({ suggestions: [], message: "All questions are already mapped to this process." });
  }

  // Build process context (capped ~3K chars)
  const contextParts: string[] = [`Process: ${proc.name}`];
  if (proc.description) contextParts.push(`Description: ${String(proc.description).slice(0, 200)}`);
  const charter = proc.charter as Record<string, unknown> | null;
  if (charter?.content) contextParts.push(`Charter:\n${String(charter.content).slice(0, 800)}`);
  const adliFields = [
    { key: "adli_approach", label: "Approach" },
    { key: "adli_deployment", label: "Deployment" },
    { key: "adli_learning", label: "Learning" },
    { key: "adli_integration", label: "Integration" },
  ] as const;
  for (const f of adliFields) {
    const val = proc[f.key] as Record<string, unknown> | null;
    if (val?.content) contextParts.push(`${f.label}:\n${String(val.content).slice(0, 400)}`);
  }
  const processContext = contextParts.join("\n\n");

  // Process questions in batches of 15 (larger batches since we're only matching one process)
  const BATCH_SIZE = 15;
  const suggestions: {
    question_id: number;
    question_code: string;
    question_text: string;
    area_label: string;
    item_code: string;
    item_name: string;
    category_name: string;
    coverage: "primary" | "supporting" | "partial";
    rationale: string;
  }[] = [];

  for (let i = 0; i < unmappedQuestions.length; i += BATCH_SIZE) {
    const batch = unmappedQuestions.slice(i, i + BATCH_SIZE);

    const questionsText = batch
      .map((q) => {
        const item = q.baldrige_items as unknown as { item_code: string; item_name: string };
        return `[Q${q.id}] ${q.question_code} (${item.item_code} ${item.item_name}): ${q.question_text}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a Baldrige Excellence Framework expert. Given a process description, identify which Baldrige questions this process addresses.

For each question that matches, return a JSON array of objects with:
- "question_id": the Q-number (just the number, e.g. 5)
- "coverage": "primary" (directly addresses the question), "supporting" (contributes to answering), or "partial" (touches on part of it)
- "rationale": 1 sentence explaining the connection

Only include questions this process genuinely addresses. Be selective — it's better to miss a weak connection than to suggest a false one.

Return a JSON array. If no questions match, return []. Return ONLY the JSON array.`;

    const userPrompt = `**Process:**
${processContext}

**Questions to evaluate:**
${questionsText}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      let parsed: { question_id: number; coverage: string; rationale: string }[] = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse AI suggestion response for batch");
      }

      for (const match of parsed) {
        const question = batch.find((q) => q.id === match.question_id);
        if (!question) continue;
        const item = question.baldrige_items as unknown as { item_code: string; item_name: string; category_name: string };
        const coverage = ["primary", "supporting", "partial"].includes(match.coverage)
          ? (match.coverage as "primary" | "supporting" | "partial")
          : "supporting";
        suggestions.push({
          question_id: question.id,
          question_code: question.question_code,
          question_text: question.question_text,
          area_label: question.area_label,
          item_code: item.item_code,
          item_name: item.item_name,
          category_name: item.category_name,
          coverage,
          rationale: match.rationale || "",
        });
      }
    } catch (err) {
      console.error("AI suggestion batch error:", err);
    }
  }

  // Sort by item_code for grouped display
  suggestions.sort((a, b) => a.item_code.localeCompare(b.item_code));

  return NextResponse.json({
    suggestions,
    total_questions: unmappedQuestions.length,
    matches: suggestions.length,
  });
}
