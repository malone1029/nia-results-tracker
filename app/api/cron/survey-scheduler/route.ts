import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateNpsScore } from "@/lib/survey-types";

export const maxDuration = 60;

// Runs hourly — opens scheduled waves and closes expired ones
export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role client to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const now = new Date().toISOString();
  let opened = 0;
  let closed = 0;
  let metricsGenerated = 0;

  // 1. Open scheduled waves whose time has come
  const { data: toOpen } = await supabase
    .from("survey_waves")
    .select("id, survey_id")
    .eq("status", "scheduled")
    .lte("scheduled_open_at", now);

  if (toOpen && toOpen.length > 0) {
    // Close any currently open waves for these surveys first
    const surveyIds = [...new Set(toOpen.map((w) => w.survey_id))];
    for (const surveyId of surveyIds) {
      await supabase
        .from("survey_waves")
        .update({ status: "closed", closed_at: now })
        .eq("survey_id", surveyId)
        .eq("status", "open");
    }

    // Open the scheduled waves
    const waveIds = toOpen.map((w) => w.id);
    const { error } = await supabase
      .from("survey_waves")
      .update({ status: "open", opened_at: now })
      .in("id", waveIds);

    if (!error) opened = waveIds.length;
  }

  // 2. Close open waves whose scheduled_close_at has passed
  const { data: toClose } = await supabase
    .from("survey_waves")
    .select("id, survey_id, wave_number, response_count")
    .eq("status", "open")
    .not("scheduled_close_at", "is", null)
    .lte("scheduled_close_at", now);

  if (toClose && toClose.length > 0) {
    for (const wave of toClose) {
      // Close the wave
      await supabase
        .from("survey_waves")
        .update({ status: "closed", closed_at: now })
        .eq("id", wave.id);

      closed++;

      // Auto-generate metric entries (same logic as manual close in PATCH)
      const metrics = await generateMetricEntries(supabase, wave.survey_id, wave.id, wave.wave_number, now);
      metricsGenerated += metrics;
    }
  }

  return NextResponse.json({
    success: true,
    opened,
    closed,
    metricsGenerated,
    timestamp: now,
  });
}

// Reused metric generation logic from the waves PATCH handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateMetricEntries(
  supabase: any,
  surveyId: number,
  waveId: number,
  waveNumber: number,
  closedAt: string
): Promise<number> {
  // Fetch survey title
  const { data: survey } = await supabase
    .from("surveys")
    .select("title")
    .eq("id", surveyId)
    .single();

  // Fetch questions with metric links
  const { data: questions } = await supabase
    .from("survey_questions")
    .select("id, question_type, metric_id, options")
    .eq("survey_id", surveyId)
    .not("metric_id", "is", null);

  if (!questions || questions.length === 0) return 0;

  // Fetch responses for this wave
  const { data: responses } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("wave_id", waveId);

  const responseIds = (responses || []).map((r: { id: number }) => r.id);
  if (responseIds.length === 0) return 0;

  // Fetch all answers
  const { data: answers } = await supabase
    .from("survey_answers")
    .select("question_id, value_numeric, value_json")
    .in("response_id", responseIds);

  type Answer = { question_id: number; value_numeric: number | null; value_json: unknown };
  const typedAnswers: Answer[] = answers || [];

  const entryDate = closedAt.split("T")[0];
  const baseNote = `Survey: ${survey?.title || "Unknown"}, Round ${waveNumber}`;
  let metricsUpdated = 0;

  for (const q of questions) {
    if (!q.metric_id) continue;

    const qAnswers = typedAnswers.filter((a) => a.question_id === q.id);
    const numericValues = qAnswers
      .filter((a) => a.value_numeric !== null)
      .map((a) => a.value_numeric as number);

    if (q.question_type === "open_text") continue;
    if (numericValues.length === 0 && q.question_type !== "checkbox") continue;

    let metricValue: number;
    let noteAnalysis: string;

    switch (q.question_type) {
      case "yes_no":
        metricValue = Math.round(
          (numericValues.filter((v) => v === 1).length / numericValues.length) * 100
        );
        noteAnalysis = `${baseNote}, ${numericValues.length} responses`;
        break;

      case "nps":
        metricValue = calculateNpsScore(numericValues);
        noteAnalysis = `${baseNote}, ${numericValues.length} responses, NPS`;
        break;

      case "checkbox":
        metricValue = qAnswers.length > 0
          ? parseFloat((numericValues.reduce((s, v) => s + v, 0) / qAnswers.length).toFixed(2))
          : 0;
        if (metricValue === 0) continue;
        noteAnalysis = `${baseNote}, ${qAnswers.length} responses, avg selections`;
        break;

      case "multiple_choice":
        metricValue = numericValues.length;
        noteAnalysis = `${baseNote}, ${numericValues.length} responses`;
        break;

      case "matrix":
        if (numericValues.length === 0) continue;
        metricValue = parseFloat(
          (numericValues.reduce((s, v) => s + v, 0) / numericValues.length).toFixed(2)
        );
        noteAnalysis = `${baseNote}, ${numericValues.length} answers, matrix avg`;
        break;

      default:
        metricValue = parseFloat(
          (numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length).toFixed(2)
        );
        noteAnalysis = `${baseNote}, ${numericValues.length} responses`;
        break;
    }

    // Idempotency check
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

  return metricsUpdated;
}
