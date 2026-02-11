import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use a plain Supabase client (no auth cookies needed for public responses)
// survey_responses and survey_answers have no RLS — anon key works
function getPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET ?token=X — fetch survey metadata + questions for public response page
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const supabase = getPublicSupabase();

  // Look up the wave by share_token
  const { data: wave, error: waveError } = await supabase
    .from("survey_waves")
    .select("id, survey_id, wave_number, status, share_token")
    .eq("share_token", token)
    .single();

  if (waveError || !wave) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  if (wave.status === "closed") {
    return NextResponse.json({ error: "This survey is no longer accepting responses", closed: true }, { status: 410 });
  }

  // Fetch survey metadata (including custom messages)
  const { data: survey, error: surveyError } = await supabase
    .from("surveys")
    .select("id, title, description, is_anonymous, welcome_message, thank_you_message")
    .eq("id", wave.survey_id)
    .single();

  if (surveyError || !survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  // Fetch questions (including new fields: options, is_required, help_text, section_label)
  const { data: questions, error: questionsError } = await supabase
    .from("survey_questions")
    .select("id, question_text, question_type, sort_order, rating_scale_max, options, is_required, help_text, section_label")
    .eq("survey_id", wave.survey_id)
    .order("sort_order", { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({
    survey: {
      title: survey.title,
      description: survey.description,
      is_anonymous: survey.is_anonymous,
      welcome_message: survey.welcome_message || null,
      thank_you_message: survey.thank_you_message || null,
    },
    questions: questions || [],
    wave_id: wave.id,
  });
}

// POST — submit survey response (no auth required)
export async function POST(request: Request) {
  const supabase = getPublicSupabase();
  const body = await request.json();

  const { token, answers, email } = body;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  if (!answers || !Array.isArray(answers)) {
    return NextResponse.json({ error: "answers are required" }, { status: 400 });
  }

  // Validate the wave exists and is open
  const { data: wave, error: waveError } = await supabase
    .from("survey_waves")
    .select("id, survey_id, status")
    .eq("share_token", token)
    .single();

  if (waveError || !wave) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  if (wave.status === "closed") {
    return NextResponse.json({ error: "This survey is no longer accepting responses" }, { status: 410 });
  }

  // Fetch all questions to validate answers and check required
  const { data: allQuestions } = await supabase
    .from("survey_questions")
    .select("id, question_type, is_required, options")
    .eq("survey_id", wave.survey_id);

  const questionMap = new Map(
    (allQuestions || []).map((q: { id: number; question_type: string; is_required: boolean; options: Record<string, unknown> | null }) => [q.id, q])
  );
  const validIds = new Set(questionMap.keys());

  // Build a set of question IDs that were submitted (to check required later)
  const submittedIds = new Set<number>();

  // Validate answer question IDs
  for (const a of answers) {
    if (!a.questionId || !validIds.has(a.questionId)) {
      return NextResponse.json(
        { error: `Invalid questionId: ${a.questionId}` },
        { status: 400 }
      );
    }
    submittedIds.add(a.questionId);
  }

  // Check required questions — only enforce for questions that aren't hidden
  // (the client sends hiddenQuestionIds so the server knows which ones to skip)
  const hiddenIds = new Set<number>(body.hiddenQuestionIds || []);

  for (const [id, q] of questionMap) {
    const qTyped = q as { id: number; question_type: string; is_required: boolean; options: Record<string, unknown> | null };
    if (qTyped.is_required && !hiddenIds.has(id) && !submittedIds.has(id)) {
      return NextResponse.json(
        { error: "Please answer all required questions" },
        { status: 400 }
      );
    }
  }

  // Insert response
  const { data: response, error: responseError } = await supabase
    .from("survey_responses")
    .insert({
      wave_id: wave.id,
      respondent_email: email || null,
    })
    .select("id")
    .single();

  if (responseError) {
    return NextResponse.json({ error: responseError.message }, { status: 500 });
  }

  // Build answer rows — supports value_json for checkbox/matrix
  const answerRows = answers.map(
    (a: { questionId: number; value: number | null; text?: string | null; json?: Record<string, unknown> | null }) => ({
      response_id: response.id,
      question_id: a.questionId,
      value_numeric: a.value ?? null,
      value_text: a.text || null,
      value_json: a.json || null,
    })
  );

  // Filter out empty rows (questions with no answer provided — optional + skipped)
  const nonEmptyRows = answerRows.filter(
    (r: { value_numeric: number | null; value_text: string | null; value_json: Record<string, unknown> | null }) =>
      r.value_numeric !== null || r.value_text !== null || r.value_json !== null
  );

  if (nonEmptyRows.length > 0) {
    const { error: answersError } = await supabase
      .from("survey_answers")
      .insert(nonEmptyRows);

    if (answersError) {
      // Rollback response
      await supabase.from("survey_responses").delete().eq("id", response.id);
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }
  }

  // Atomically increment response count on the wave
  // Uses SECURITY DEFINER function to bypass RLS (anon users can't update survey_waves directly)
  await supabase.rpc("increment_wave_response_count", {
    wave_id_input: wave.id,
  });

  return NextResponse.json({ success: true });
}
