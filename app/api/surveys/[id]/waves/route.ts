import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { calculateNpsScore } from "@/lib/survey-types";

// GET — list waves for a survey
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServer();
  const { id } = await params;

  const { data, error } = await supabase
    .from("survey_waves")
    .select("*")
    .eq("survey_id", Number(id))
    .order("wave_number", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST — create new wave (auto-close previous open wave)
// Accepts optional body: { openAt?: string, closeAfterDays?: number }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);

  // Parse optional scheduling params from body
  let openAt: string | null = null;
  let closeAfterDays: number | null = null;
  try {
    const body = await request.json();
    openAt = body?.openAt || null;
    closeAfterDays = body?.closeAfterDays || null;
  } catch {
    // No body = immediate open (backwards compatible)
  }

  const now = new Date().toISOString();
  const isScheduled = openAt && new Date(openAt) > new Date();

  // Auto-close any currently open wave for this survey (unless scheduling future)
  if (!isScheduled) {
    await supabase
      .from("survey_waves")
      .update({ status: "closed", closed_at: now })
      .eq("survey_id", surveyId)
      .eq("status", "open");
  }

  // Get the next wave number
  const { data: lastWave } = await supabase
    .from("survey_waves")
    .select("wave_number")
    .eq("survey_id", surveyId)
    .order("wave_number", { ascending: false })
    .limit(1)
    .single();

  const nextWaveNumber = (lastWave?.wave_number || 0) + 1;

  // Generate a URL-safe share token with sufficient entropy (80 bits)
  const shareToken = crypto.randomUUID().replace(/-/g, "").slice(0, 20);

  // Calculate scheduled close time if closeAfterDays is set
  const openDate = isScheduled ? new Date(openAt!) : new Date();
  const scheduledCloseAt = closeAfterDays
    ? new Date(openDate.getTime() + closeAfterDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: wave, error } = await supabase
    .from("survey_waves")
    .insert({
      survey_id: surveyId,
      wave_number: nextWaveNumber,
      status: isScheduled ? "scheduled" : "open",
      share_token: shareToken,
      opened_at: isScheduled ? null : now,
      scheduled_open_at: isScheduled ? new Date(openAt!).toISOString() : null,
      scheduled_close_at: scheduledCloseAt,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(wave);
}

// PATCH — close a wave and auto-generate metric entries from survey answers
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const body = await request.json();
  const { waveId } = body;

  if (!waveId) {
    return NextResponse.json({ error: "waveId is required" }, { status: 400 });
  }

  const closedAt = new Date().toISOString();

  // Close the wave
  const { error: closeError } = await supabase
    .from("survey_waves")
    .update({ status: "closed", closed_at: closedAt })
    .eq("id", waveId)
    .eq("survey_id", Number(id));

  if (closeError) {
    return NextResponse.json({ error: closeError.message }, { status: 500 });
  }

  // Fetch wave details
  const { data: wave } = await supabase
    .from("survey_waves")
    .select("*")
    .eq("id", waveId)
    .single();

  // Fetch survey title for the metric entry note
  const { data: survey } = await supabase
    .from("surveys")
    .select("title")
    .eq("id", Number(id))
    .single();

  // --- Auto-generate metric entries ---
  // Fetch questions that have a metric_id linked
  const { data: questions } = await supabase
    .from("survey_questions")
    .select("id, question_type, metric_id, options")
    .eq("survey_id", Number(id))
    .not("metric_id", "is", null);

  let metricsUpdated = 0;

  if (questions && questions.length > 0) {
    // Fetch all responses for this wave
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("id")
      .eq("wave_id", waveId);

    const responseIds = (responses || []).map((r: { id: number }) => r.id);

    if (responseIds.length > 0) {
      // Fetch all answers for these responses (include value_json for checkbox)
      const { data: answers } = await supabase
        .from("survey_answers")
        .select("question_id, value_numeric, value_json")
        .in("response_id", responseIds);

      const entryDate = closedAt.split("T")[0]; // YYYY-MM-DD
      const baseNote = `Survey: ${survey?.title || "Unknown"}, Round ${wave?.wave_number || "?"}`;

      for (const q of questions) {
        if (!q.metric_id) continue;

        const qAnswers = (answers || []).filter((a) => a.question_id === q.id);
        const numericValues = qAnswers
          .filter((a) => a.value_numeric !== null)
          .map((a) => a.value_numeric as number);

        // Skip types that don't produce meaningful metric values
        // open_text has no numeric data; multiple_choice mode is rarely useful as a metric
        if (q.question_type === "open_text") continue;
        if (numericValues.length === 0 && q.question_type !== "checkbox") continue;

        let metricValue: number;
        let noteAnalysis: string;

        switch (q.question_type) {
          case "yes_no":
            // Percentage of "Yes" (value 1)
            metricValue = Math.round(
              (numericValues.filter((v) => v === 1).length / numericValues.length) * 100
            );
            noteAnalysis = `${baseNote}, ${numericValues.length} responses`;
            break;

          case "nps":
            // NPS score (% Promoters - % Detractors)
            metricValue = calculateNpsScore(numericValues);
            noteAnalysis = `${baseNote}, ${numericValues.length} responses, NPS`;
            break;

          case "checkbox":
            // Average number of selections per respondent
            metricValue = qAnswers.length > 0
              ? parseFloat((numericValues.reduce((s, v) => s + v, 0) / qAnswers.length).toFixed(2))
              : 0;
            if (metricValue === 0) continue;
            noteAnalysis = `${baseNote}, ${qAnswers.length} responses, avg selections`;
            break;

          case "multiple_choice":
            // Mode index isn't very useful as a metric — use response count instead
            metricValue = numericValues.length;
            noteAnalysis = `${baseNote}, ${numericValues.length} responses`;
            break;

          case "matrix":
            // Matrix creates one entry per row — skip the main metric_id approach
            // (Per-row metric linking deferred to Layer 4)
            // For now, use the overall average across all rows
            if (numericValues.length === 0) continue;
            metricValue = parseFloat(
              (numericValues.reduce((s, v) => s + v, 0) / numericValues.length).toFixed(2)
            );
            noteAnalysis = `${baseNote}, ${numericValues.length} answers, matrix avg`;
            break;

          default:
            // rating — average
            metricValue = parseFloat(
              (numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length).toFixed(2)
            );
            noteAnalysis = `${baseNote}, ${numericValues.length} responses`;
            break;
        }

        // Idempotency check: don't insert if an entry with the same metric + date + exact note already exists
        const { data: existing } = await supabase
          .from("entries")
          .select("id")
          .eq("metric_id", q.metric_id)
          .eq("date", entryDate)
          .eq("note_analysis", noteAnalysis)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { error: insertError } = await supabase
          .from("entries")
          .insert({
            metric_id: q.metric_id,
            value: metricValue,
            date: entryDate,
            note_analysis: noteAnalysis,
          });

        if (!insertError) metricsUpdated++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    wave,
    metricsUpdated,
    responsesProcessed: wave?.response_count || 0,
  });
}
