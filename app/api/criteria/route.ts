import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/criteria
 * Returns all Baldrige items with their questions and any mapped processes.
 * Nested structure: items → questions → mappings (with process name).
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  // Fetch all three tables in parallel
  const [itemsRes, questionsRes, mappingsRes] = await Promise.all([
    supabase.from("baldrige_items").select("*").order("sort_order"),
    supabase.from("baldrige_questions").select("*").order("sort_order"),
    supabase
      .from("process_question_mappings")
      .select("*, processes(id, name, owner, baldrige_item)"),
  ]);

  if (itemsRes.error || questionsRes.error || mappingsRes.error) {
    const msg =
      itemsRes.error?.message ||
      questionsRes.error?.message ||
      mappingsRes.error?.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Build mapping lookup: question_id → mappings[]
  const mappingsByQuestion = new Map<number, typeof mappingsRes.data>();
  for (const m of mappingsRes.data || []) {
    const list = mappingsByQuestion.get(m.question_id) || [];
    list.push(m);
    mappingsByQuestion.set(m.question_id, list);
  }

  // Build question lookup: item_id → questions[]
  const questionsByItem = new Map<number, typeof questionsRes.data>();
  for (const q of questionsRes.data || []) {
    const list = questionsByItem.get(q.item_id) || [];
    list.push(q);
    questionsByItem.set(q.item_id, list);
  }

  // Assemble nested structure
  const items = (itemsRes.data || []).map((item) => {
    const questions = (questionsByItem.get(item.id) || []).map((q) => ({
      ...q,
      mappings: mappingsByQuestion.get(q.id) || [],
    }));

    const totalQuestions = questions.length;
    const mappedQuestions = questions.filter((q) =>
      q.mappings.some((m: { coverage: string }) => m.coverage === "primary")
    ).length;

    return {
      ...item,
      questions,
      totalQuestions,
      mappedQuestions,
      coveragePct:
        totalQuestions > 0
          ? Math.round((mappedQuestions / totalQuestions) * 100)
          : 0,
    };
  });

  return NextResponse.json(items);
}
