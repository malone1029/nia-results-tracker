import { createSupabaseServer } from '@/lib/supabase-server';
import { calculateNpsScore } from '@/lib/survey-types';
import ReactPDF from '@react-pdf/renderer';
import { SurveyPdfDocument } from '@/lib/survey-pdf';

export const maxDuration = 60;

interface QuestionResult {
  question_text: string;
  question_type: string;
  avg_value: number;
  response_count: number;
  distribution?: number[];
  nps_score?: number;
  nps_segments?: { detractors: number; passives: number; promoters: number };
  option_counts?: number[];
  option_labels?: string[];
  text_responses?: string[];
  matrix_rows?: { row_label: string; avg_value: number }[];
  column_labels?: string[];
}

interface AiSummary {
  key_findings: string[];
  strengths: string[];
  areas_for_improvement: string[];
  notable_comments: string[];
  recommended_actions: string[];
}

// POST — generate PDF report for a survey wave
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);

  const body = await request.json();
  const { waveId, summary } = body as { waveId: number; summary?: AiSummary };

  if (!waveId) {
    return new Response(JSON.stringify({ error: 'waveId is required' }), { status: 400 });
  }

  // Fetch survey, wave, questions, responses in parallel
  const [surveyRes, waveRes, questionsRes, processRes] = await Promise.all([
    supabase.from('surveys').select('title').eq('id', surveyId).single(),
    supabase.from('survey_waves').select('*').eq('id', waveId).eq('survey_id', surveyId).single(),
    supabase
      .from('survey_questions')
      .select('id, question_text, question_type, rating_scale_max, options')
      .eq('survey_id', surveyId)
      .order('sort_order'),
    supabase
      .from('surveys')
      .select('process_id')
      .eq('id', surveyId)
      .single()
      .then(async (s) => {
        if (s.data?.process_id) {
          return supabase.from('processes').select('name').eq('id', s.data.process_id).single();
        }
        return { data: null };
      }),
  ]);

  const survey = surveyRes.data;
  const wave = waveRes.data;
  const questions = questionsRes.data;

  if (!wave || !questions) {
    return new Response(JSON.stringify({ error: 'Data not found' }), { status: 404 });
  }

  // Fetch responses + answers
  const { data: responses } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('wave_id', waveId);

  const responseIds = (responses || []).map((r: { id: number }) => r.id);

  let questionResults: QuestionResult[] = [];

  if (responseIds.length > 0) {
    const { data: answers } = await supabase
      .from('survey_answers')
      .select('question_id, value_numeric, value_text, value_json')
      .in('response_id', responseIds);

    const allAnswers = answers || [];

    questionResults = questions.map((q) => {
      const qAnswers = allAnswers.filter((a) => a.question_id === q.id);
      const numericValues = qAnswers
        .filter((a) => a.value_numeric !== null)
        .map((a) => a.value_numeric as number);

      const base: QuestionResult = {
        question_text: q.question_text,
        question_type: q.question_type,
        avg_value: 0,
        response_count: qAnswers.length,
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
        case 'nps': {
          const npsScore = calculateNpsScore(numericValues);
          const detractors = numericValues.filter((v) => v <= 6).length;
          const passives = numericValues.filter((v) => v >= 7 && v <= 8).length;
          const promoters = numericValues.filter((v) => v >= 9).length;
          return {
            ...base,
            avg_value: npsScore,
            nps_score: npsScore,
            nps_segments: { detractors, passives, promoters },
          };
        }
        case 'yes_no': {
          const avg =
            numericValues.length > 0
              ? Math.round(
                  (numericValues.filter((v) => v === 1).length / numericValues.length) * 100
                )
              : 0;
          return { ...base, avg_value: avg };
        }
        case 'multiple_choice':
        case 'checkbox': {
          const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
          const counts = choices.map(() => 0);
          for (const a of qAnswers) {
            if (q.question_type === 'checkbox') {
              const json = a.value_json as { selected?: number[] } | null;
              if (json?.selected) {
                for (const idx of json.selected) {
                  if (idx >= 0 && idx < choices.length) counts[idx]++;
                }
              }
            } else {
              const idx = a.value_numeric;
              if (idx !== null && idx >= 0 && idx < choices.length) counts[idx]++;
            }
          }
          return { ...base, option_counts: counts, option_labels: choices };
        }
        case 'open_text': {
          const texts = qAnswers
            .filter((a) => a.value_text && a.value_text.trim())
            .map((a) => a.value_text as string);
          return { ...base, text_responses: texts.slice(0, 10) };
        }
        case 'matrix': {
          const rows = ((q.options as Record<string, unknown>)?.rows as string[]) || [];
          const columns = ((q.options as Record<string, unknown>)?.columns as string[]) || [];
          const matrixRows = rows.map((rowLabel, ri) => {
            const rowAnswers = qAnswers.filter((a) => {
              const json = a.value_json as { row_index?: number } | null;
              return json?.row_index === ri;
            });
            const rowNumerics = rowAnswers
              .filter((a) => a.value_numeric !== null)
              .map((a) => a.value_numeric as number);
            const rowAvg =
              rowNumerics.length > 0
                ? rowNumerics.reduce((s, v) => s + v, 0) / rowNumerics.length
                : 0;
            return { row_label: rowLabel, avg_value: rowAvg };
          });
          return { ...base, matrix_rows: matrixRows, column_labels: columns };
        }
        default:
          return base;
      }
    });
  }

  // Generate PDF
  const pdfData = {
    surveyTitle: survey?.title || 'Survey',
    processName: processRes.data?.name || '',
    waveNumber: wave.wave_number,
    closedAt: wave.closed_at || wave.opened_at,
    responseCount: responseIds.length,
    questions: questionResults,
    summary: summary || null,
  };

  try {
    const stream = await ReactPDF.renderToStream(SurveyPdfDocument(pdfData));

    // Convert Node readable stream to web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err: Error) => controller.error(err));
      },
    });

    const filename = `${slugify(survey?.title || 'survey')}-round-${wave.wave_number}.pdf`;

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
