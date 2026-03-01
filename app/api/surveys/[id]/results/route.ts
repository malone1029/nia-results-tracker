import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { calculateNpsScore } from '@/lib/survey-types';

interface AnswerRow {
  question_id: number;
  value_numeric: number | null;
  value_text: string | null;
  value_json: Record<string, unknown> | null;
  response_id: number;
}

interface QuestionRow {
  id: number;
  question_text: string;
  question_type: string;
  sort_order: number;
  rating_scale_max: number;
  options: Record<string, unknown> | null;
}

// GET ?waveId=N — returns aggregated results for a survey wave
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const waveId = searchParams.get('waveId');

  if (!waveId) {
    return NextResponse.json({ error: 'waveId is required' }, { status: 400 });
  }

  // Fetch wave info
  const { data: wave, error: waveError } = await supabase
    .from('survey_waves')
    .select('*')
    .eq('id', Number(waveId))
    .eq('survey_id', Number(id))
    .single();

  if (waveError || !wave) {
    return NextResponse.json({ error: 'Wave not found' }, { status: 404 });
  }

  // Fetch questions for this survey (include options for choice labels + matrix config)
  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_text, question_type, sort_order, rating_scale_max, options')
    .eq('survey_id', Number(id))
    .order('sort_order', { ascending: true });

  if (!questions || questions.length === 0) {
    return NextResponse.json({ wave, questions: [], comments: [] });
  }

  // Fetch all responses for this wave
  const { data: responses } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('wave_id', Number(waveId));

  const responseIds = (responses || []).map((r: { id: number }) => r.id);

  if (responseIds.length === 0) {
    return NextResponse.json({
      wave,
      questions: questions.map((q: QuestionRow) => buildEmptyResult(q)),
      comments: [],
    });
  }

  // Fetch all answers for these responses (include value_json for checkbox/matrix)
  const { data: answers } = await supabase
    .from('survey_answers')
    .select('question_id, value_numeric, value_text, value_json, response_id')
    .in('response_id', responseIds);

  const allAnswers = (answers || []) as AnswerRow[];

  // Aggregate per question
  const questionResults = questions.map((q: QuestionRow) =>
    aggregateQuestion(q, allAnswers, responseIds.length)
  );

  // Get previous wave for trend comparison
  if (wave.wave_number > 1) {
    await addTrendComparison(supabase, Number(id), wave.wave_number, questionResults);
  }

  // Collect text comments (from all question types)
  const comments = allAnswers
    .filter((a) => a.value_text && a.value_text.trim())
    .map((a) => a.value_text as string);

  return NextResponse.json({
    wave,
    questions: questionResults,
    comments,
  });
}

// Build empty result for a question (no responses yet)
function buildEmptyResult(q: QuestionRow) {
  const base = {
    question_id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    avg_value: 0,
    response_count: 0,
    previous_avg: null as number | null,
  };

  switch (q.question_type) {
    case 'rating': {
      const max = q.rating_scale_max || 5;
      return { ...base, distribution: new Array(max).fill(0) };
    }
    case 'nps':
      return {
        ...base,
        distribution: new Array(11).fill(0),
        nps_score: 0,
        nps_segments: { detractors: 0, passives: 0, promoters: 0 },
      };
    case 'multiple_choice':
    case 'checkbox': {
      const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
      return { ...base, option_counts: choices.map(() => 0), option_labels: choices };
    }
    case 'open_text':
      return { ...base, text_responses: [] };
    case 'matrix': {
      const rows = ((q.options as Record<string, unknown>)?.rows as string[]) || [];
      const columns = ((q.options as Record<string, unknown>)?.columns as string[]) || [];
      return {
        ...base,
        matrix_rows: rows.map((r) => ({
          row_label: r,
          avg_value: 0,
          distribution: columns.map(() => 0),
        })),
        column_labels: columns,
      };
    }
    default:
      return { ...base, distribution: [] };
  }
}

// Aggregate answers for a single question
function aggregateQuestion(q: QuestionRow, allAnswers: AnswerRow[], totalResponses: number) {
  const qAnswers = allAnswers.filter((a) => a.question_id === q.id);
  const numericValues = qAnswers
    .filter((a) => a.value_numeric !== null)
    .map((a) => a.value_numeric as number);

  const base = {
    question_id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    response_count: qAnswers.length,
    previous_avg: null as number | null,
  };

  switch (q.question_type) {
    case 'rating': {
      const max = q.rating_scale_max || 5;
      const avg =
        numericValues.length > 0
          ? numericValues.reduce((s, v) => s + v, 0) / numericValues.length
          : 0;
      const distribution = new Array(max).fill(0);
      for (const v of numericValues) {
        const bucket = Math.round(v) - 1;
        if (bucket >= 0 && bucket < max) distribution[bucket]++;
      }
      return { ...base, avg_value: avg, distribution };
    }

    case 'yes_no': {
      const avg =
        numericValues.length > 0
          ? numericValues.reduce((s, v) => s + v, 0) / numericValues.length
          : 0;
      return { ...base, avg_value: avg, distribution: [] };
    }

    case 'nps': {
      const npsScore = calculateNpsScore(numericValues);
      const avg =
        numericValues.length > 0
          ? numericValues.reduce((s, v) => s + v, 0) / numericValues.length
          : 0;
      const distribution = new Array(11).fill(0);
      for (const v of numericValues) {
        if (v >= 0 && v <= 10) distribution[v]++;
      }
      const detractors = numericValues.filter((v) => v <= 6).length;
      const passives = numericValues.filter((v) => v >= 7 && v <= 8).length;
      const promoters = numericValues.filter((v) => v >= 9).length;
      return {
        ...base,
        avg_value: npsScore,
        distribution,
        nps_score: npsScore,
        nps_segments: { detractors, passives, promoters },
      };
    }

    case 'multiple_choice': {
      const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
      const optionCounts = choices.map(() => 0);
      let otherCount = 0;
      const otherTexts: string[] = [];
      for (const a of qAnswers) {
        const idx = a.value_numeric;
        if (idx !== null && idx >= 0 && idx < choices.length) {
          optionCounts[idx]++;
        }
        // "Other" responses have value_text but index might equal choices.length
        if (a.value_text && a.value_text.trim()) {
          otherCount++;
          otherTexts.push(a.value_text);
        }
      }
      return {
        ...base,
        avg_value: 0, // Not meaningful for MC
        option_counts: optionCounts,
        option_labels: choices,
        other_count: otherCount,
        other_texts: otherTexts,
      };
    }

    case 'checkbox': {
      const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
      const optionCounts = choices.map(() => 0);
      let otherCount = 0;
      const otherTexts: string[] = [];
      for (const a of qAnswers) {
        const json = a.value_json as { selected?: number[] } | null;
        if (json?.selected) {
          for (const idx of json.selected) {
            if (idx >= 0 && idx < choices.length) {
              optionCounts[idx]++;
            }
          }
        }
        if (a.value_text && a.value_text.trim()) {
          otherCount++;
          otherTexts.push(a.value_text);
        }
      }
      // Avg = average number of selections per respondent
      const avgSelections =
        qAnswers.length > 0 ? numericValues.reduce((s, v) => s + v, 0) / qAnswers.length : 0;
      return {
        ...base,
        avg_value: avgSelections,
        option_counts: optionCounts,
        option_labels: choices,
        other_count: otherCount,
        other_texts: otherTexts,
        total_respondents: totalResponses,
      };
    }

    case 'open_text': {
      const textResponses = qAnswers
        .filter((a) => a.value_text && a.value_text.trim())
        .map((a) => a.value_text as string);
      return {
        ...base,
        avg_value: 0,
        text_responses: textResponses,
        response_count: textResponses.length,
      };
    }

    case 'matrix': {
      const rows = ((q.options as Record<string, unknown>)?.rows as string[]) || [];
      const columns = ((q.options as Record<string, unknown>)?.columns as string[]) || [];
      const matrixRows = rows.map((rowLabel, rowIdx) => {
        const rowAnswers = qAnswers.filter((a) => {
          const json = a.value_json as { row_index?: number } | null;
          return json?.row_index === rowIdx;
        });
        const rowNumerics = rowAnswers
          .filter((a) => a.value_numeric !== null)
          .map((a) => a.value_numeric as number);
        const rowAvg =
          rowNumerics.length > 0 ? rowNumerics.reduce((s, v) => s + v, 0) / rowNumerics.length : 0;
        const distribution = columns.map(() => 0);
        for (const v of rowNumerics) {
          if (v >= 0 && v < columns.length) distribution[v]++;
        }
        return {
          row_label: rowLabel,
          avg_value: rowAvg,
          response_count: rowNumerics.length,
          distribution,
        };
      });
      // Overall matrix avg (average of row averages)
      const overallAvg =
        matrixRows.length > 0
          ? matrixRows.reduce((s, r) => s + r.avg_value, 0) / matrixRows.length
          : 0;
      return {
        ...base,
        avg_value: overallAvg,
        matrix_rows: matrixRows,
        column_labels: columns,
      };
    }

    default: {
      const avg =
        numericValues.length > 0
          ? numericValues.reduce((s, v) => s + v, 0) / numericValues.length
          : 0;
      return { ...base, avg_value: avg, distribution: [] };
    }
  }
}

// Add trend comparison from previous wave
async function addTrendComparison(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  surveyId: number,
  currentWaveNumber: number,
  questionResults: { question_id: number; question_type: string; previous_avg: number | null }[]
) {
  const { data: prevWave } = await supabase
    .from('survey_waves')
    .select('id')
    .eq('survey_id', surveyId)
    .eq('wave_number', currentWaveNumber - 1)
    .single();

  if (!prevWave) return;

  const { data: prevResponses } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('wave_id', prevWave.id);

  const prevResponseIds = (prevResponses || []).map((r: { id: number }) => r.id);
  if (prevResponseIds.length === 0) return;

  const { data: prevAnswers } = await supabase
    .from('survey_answers')
    .select('question_id, value_numeric, value_json')
    .in('response_id', prevResponseIds);

  if (!prevAnswers) return;

  for (const qr of questionResults) {
    // Skip types where trend comparison doesn't make sense
    if (['open_text', 'multiple_choice', 'checkbox'].includes(qr.question_type)) continue;

    if (qr.question_type === 'nps') {
      const prevNpsValues = prevAnswers
        .filter((a) => a.question_id === qr.question_id && a.value_numeric !== null)
        .map((a) => a.value_numeric as number);
      if (prevNpsValues.length > 0) {
        qr.previous_avg = calculateNpsScore(prevNpsValues);
      }
    } else {
      // rating, yes_no — simple average comparison
      const prevQAnswers = prevAnswers.filter(
        (a) => a.question_id === qr.question_id && a.value_numeric !== null
      );
      if (prevQAnswers.length > 0) {
        qr.previous_avg =
          prevQAnswers.reduce((sum, a) => sum + (a.value_numeric as number), 0) /
          prevQAnswers.length;
      }
    }
  }
}
