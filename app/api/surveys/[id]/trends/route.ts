import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { calculateNpsScore } from '@/lib/survey-types';

// GET — returns aggregated results for ALL waves of a survey (for trend charts)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);

  // Fetch all waves for this survey
  const { data: waves, error: wavesError } = await supabase
    .from('survey_waves')
    .select('*')
    .eq('survey_id', surveyId)
    .order('wave_number', { ascending: true });

  if (wavesError) {
    return NextResponse.json({ error: wavesError.message }, { status: 500 });
  }

  if (!waves || waves.length === 0) {
    return NextResponse.json({ waves: [], questions: [] });
  }

  // Fetch questions for this survey
  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_text, question_type, sort_order, rating_scale_max, options')
    .eq('survey_id', surveyId)
    .order('sort_order', { ascending: true });

  if (!questions || questions.length === 0) {
    return NextResponse.json({ waves, questions: [] });
  }

  // For each wave, fetch responses + compute per-question averages
  const waveResults = await Promise.all(
    waves.map(async (wave) => {
      const { data: responses } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('wave_id', wave.id);

      const responseIds = (responses || []).map((r: { id: number }) => r.id);

      if (responseIds.length === 0) {
        return {
          wave_id: wave.id,
          wave_number: wave.wave_number,
          opened_at: wave.opened_at,
          closed_at: wave.closed_at,
          response_count: 0,
          questions: questions.map((q) => ({
            question_id: q.id,
            avg_value: null,
            nps_score: null,
            response_count: 0,
          })),
        };
      }

      const { data: answers } = await supabase
        .from('survey_answers')
        .select('question_id, value_numeric')
        .in('response_id', responseIds);

      const allAnswers = answers || [];

      const questionStats = questions.map((q) => {
        const qAnswers = allAnswers.filter((a) => a.question_id === q.id);
        const numericValues = qAnswers
          .filter((a) => a.value_numeric !== null)
          .map((a) => a.value_numeric as number);

        let avgValue: number | null = null;
        let npsScore: number | null = null;

        if (numericValues.length > 0) {
          if (q.question_type === 'nps') {
            npsScore = calculateNpsScore(numericValues);
            avgValue = npsScore;
          } else if (q.question_type === 'yes_no') {
            avgValue = Math.round(
              (numericValues.filter((v) => v === 1).length / numericValues.length) * 100
            );
          } else {
            avgValue = parseFloat(
              (numericValues.reduce((s, v) => s + v, 0) / numericValues.length).toFixed(2)
            );
          }
        }

        return {
          question_id: q.id,
          avg_value: avgValue,
          nps_score: npsScore,
          response_count: numericValues.length,
        };
      });

      return {
        wave_id: wave.id,
        wave_number: wave.wave_number,
        opened_at: wave.opened_at,
        closed_at: wave.closed_at,
        response_count: responseIds.length,
        questions: questionStats,
      };
    })
  );

  return NextResponse.json({
    waves: waveResults,
    questions: questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      sort_order: q.sort_order,
    })),
  });
}
