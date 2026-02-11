import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

const VALID_QUESTION_TYPES = ["rating", "yes_no", "nps", "multiple_choice", "checkbox", "open_text", "matrix"];

interface QuestionInput {
  question_text: string;
  question_type: string;
  sort_order?: number;
  rating_scale_max?: number;
  metric_id?: number | null;
  options?: Record<string, unknown>;
  is_required?: boolean;
  help_text?: string;
  section_label?: string;
}

// GET ?processId=N — returns surveys with question count + latest wave info
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");

  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }

  const { data: surveys, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("process_id", Number(processId))
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each survey, fetch question count + latest wave
  const enriched = await Promise.all(
    (surveys || []).map(async (s) => {
      const [questionsRes, wavesRes] = await Promise.all([
        supabase
          .from("survey_questions")
          .select("id", { count: "exact", head: true })
          .eq("survey_id", s.id),
        supabase
          .from("survey_waves")
          .select("*")
          .eq("survey_id", s.id)
          .order("wave_number", { ascending: false })
          .limit(1),
      ]);

      return {
        ...s,
        question_count: questionsRes.count || 0,
        latest_wave: wavesRes.data?.[0] || null,
      };
    })
  );

  return NextResponse.json(enriched);
}

// POST — creates survey + questions in one request
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { process_id, title, description, is_public, is_anonymous, welcome_message, thank_you_message, questions } = body;

  if (!process_id || !title) {
    return NextResponse.json(
      { error: "process_id and title are required" },
      { status: 400 }
    );
  }

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { error: "At least one question is required" },
      { status: 400 }
    );
  }

  // Validate question types
  for (const q of questions as QuestionInput[]) {
    if (!q.question_text || !q.question_type) {
      return NextResponse.json(
        { error: "Each question requires question_text and question_type" },
        { status: 400 }
      );
    }
    if (!VALID_QUESTION_TYPES.includes(q.question_type)) {
      return NextResponse.json(
        { error: `Invalid question_type: ${q.question_type}. Must be one of: ${VALID_QUESTION_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Insert survey
  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .insert({
      process_id,
      title,
      description: description || null,
      is_public: is_public ?? true,
      is_anonymous: is_anonymous ?? true,
      welcome_message: welcome_message || null,
      thank_you_message: thank_you_message || null,
      created_by: user?.id || null,
    })
    .select("id")
    .single();

  if (surveyError) {
    return NextResponse.json({ error: surveyError.message }, { status: 500 });
  }

  // Insert questions
  const questionRows = (questions as QuestionInput[]).map((q, i) => ({
    survey_id: survey.id,
    question_text: q.question_text,
    question_type: q.question_type,
    sort_order: q.sort_order ?? i,
    rating_scale_max: q.rating_scale_max ?? 5,
    metric_id: q.metric_id || null,
    options: q.options || {},
    is_required: q.is_required ?? true,
    help_text: q.help_text || null,
    section_label: q.section_label || null,
  }));

  const { error: questionsError } = await supabase
    .from("survey_questions")
    .insert(questionRows);

  if (questionsError) {
    // Rollback: delete the survey (CASCADE will clean up)
    await supabase.from("surveys").delete().eq("id", survey.id);
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({ id: survey.id, success: true });
}

// PATCH — update survey settings + replace questions array
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();
  const { id, title, description, is_public, is_anonymous, welcome_message, thank_you_message, questions } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Update survey fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (is_public !== undefined) updates.is_public = is_public;
  if (is_anonymous !== undefined) updates.is_anonymous = is_anonymous;
  if (welcome_message !== undefined) updates.welcome_message = welcome_message;
  if (thank_you_message !== undefined) updates.thank_you_message = thank_you_message;

  const { error: updateError } = await supabase
    .from("surveys")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Replace questions if provided (insert new first, then delete old — prevents data loss on insert failure)
  if (questions && Array.isArray(questions)) {
    const questionRows = (questions as QuestionInput[]).map((q, i) => ({
      survey_id: id,
      question_text: q.question_text,
      question_type: q.question_type,
      sort_order: q.sort_order ?? i,
      rating_scale_max: q.rating_scale_max ?? 5,
      metric_id: q.metric_id || null,
      options: q.options || {},
      is_required: q.is_required ?? true,
      help_text: q.help_text || null,
      section_label: q.section_label || null,
    }));

    // Fetch existing question IDs before inserting new ones
    const { data: oldQuestions } = await supabase
      .from("survey_questions")
      .select("id")
      .eq("survey_id", id);
    const oldIds = (oldQuestions || []).map((q: { id: number }) => q.id);

    // Insert new questions first
    const { error: questionsError } = await supabase
      .from("survey_questions")
      .insert(questionRows);

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    // Only delete old questions after new ones succeed
    if (oldIds.length > 0) {
      await supabase.from("survey_questions").delete().in("id", oldIds);
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE ?id=N — delete a survey (CASCADE handles everything)
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("surveys")
    .delete()
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
