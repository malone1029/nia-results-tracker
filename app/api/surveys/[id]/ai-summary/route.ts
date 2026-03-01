import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServer } from '@/lib/supabase-server';
import { calculateNpsScore } from '@/lib/survey-types';

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

const SYSTEM_PROMPT = `You are a survey analyst for NIA, a healthcare education organization. Analyze survey results and write a concise executive summary.

## Output Format
Return ONLY valid JSON with this exact structure (no markdown fences):

{
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "strengths": ["Strength 1", "Strength 2"],
  "areas_for_improvement": ["Area 1", "Area 2"],
  "notable_comments": ["Quoted or paraphrased comment 1", "Comment 2"],
  "recommended_actions": ["Action 1", "Action 2", "Action 3"]
}

## Guidelines
- Key findings: 3-5 most important takeaways from the data
- Strengths: what's working well (high scores, positive comments)
- Areas for improvement: low scores, negative themes, gaps
- Notable comments: 2-4 direct quotes or paraphrases that capture the voice of respondents
- Recommended actions: specific, actionable next steps based on the data
- Be concise — each bullet should be 1-2 sentences max
- Reference specific numbers (e.g., "4.2/5 average" or "72% agree")
- If NPS data exists, interpret it (below 0 = concern, 0-30 = okay, 30-70 = good, 70+ = excellent)`;

// POST — generate AI executive summary for a survey wave
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const { waveId } = body;

  if (!waveId) {
    return new Response(JSON.stringify({ error: 'waveId is required' }), { status: 400 });
  }

  // Fetch wave info
  const { data: wave } = await supabase
    .from('survey_waves')
    .select('*')
    .eq('id', Number(waveId))
    .eq('survey_id', surveyId)
    .single();

  if (!wave) {
    return new Response(JSON.stringify({ error: 'Wave not found' }), { status: 404 });
  }

  // Fetch survey title
  const { data: survey } = await supabase
    .from('surveys')
    .select('title, process_id')
    .eq('id', surveyId)
    .single();

  // Fetch questions
  const { data: questions } = await supabase
    .from('survey_questions')
    .select('id, question_text, question_type, rating_scale_max, options')
    .eq('survey_id', surveyId)
    .order('sort_order', { ascending: true });

  if (!questions || questions.length === 0) {
    return new Response(JSON.stringify({ error: 'No questions found' }), { status: 400 });
  }

  // Fetch responses for this wave
  const { data: responses } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('wave_id', Number(waveId));

  const responseIds = (responses || []).map((r: { id: number }) => r.id);

  if (responseIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No responses for this wave' }), { status: 400 });
  }

  // Fetch all answers
  const { data: answers } = await supabase
    .from('survey_answers')
    .select('question_id, value_numeric, value_text, value_json')
    .in('response_id', responseIds);

  const allAnswers = answers || [];

  // Build results summary for AI (capped at ~4000 chars)
  let resultsSummary = `Survey: ${survey?.title || 'Unknown'}\nRound: ${wave.wave_number}\nTotal responses: ${responseIds.length}\n\n`;

  const openTextResponses: string[] = [];

  for (const q of questions) {
    const qAnswers = allAnswers.filter((a) => a.question_id === q.id);
    const numericValues = qAnswers
      .filter((a) => a.value_numeric !== null)
      .map((a) => a.value_numeric as number);

    resultsSummary += `Q: ${q.question_text} (${q.question_type})\n`;

    switch (q.question_type) {
      case 'rating': {
        if (numericValues.length > 0) {
          const avg = (numericValues.reduce((s, v) => s + v, 0) / numericValues.length).toFixed(2);
          const labels = ((q.options as Record<string, unknown>)?.labels as string[]) || [];
          resultsSummary += `  Average: ${avg}/${q.rating_scale_max} (${numericValues.length} responses)`;
          if (labels.length > 0) {
            resultsSummary += ` Scale: ${labels[0]} to ${labels[labels.length - 1]}`;
          }
          resultsSummary += '\n';
        }
        break;
      }
      case 'nps': {
        if (numericValues.length > 0) {
          const nps = calculateNpsScore(numericValues);
          const promoters = numericValues.filter((v) => v >= 9).length;
          const detractors = numericValues.filter((v) => v <= 6).length;
          const passives = numericValues.length - promoters - detractors;
          resultsSummary += `  NPS: ${nps} (${promoters} promoters, ${passives} passives, ${detractors} detractors out of ${numericValues.length})\n`;
        }
        break;
      }
      case 'yes_no': {
        if (numericValues.length > 0) {
          const yesCount = numericValues.filter((v) => v === 1).length;
          resultsSummary += `  Yes: ${yesCount}/${numericValues.length} (${Math.round((yesCount / numericValues.length) * 100)}%)\n`;
        }
        break;
      }
      case 'multiple_choice': {
        const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
        const counts = choices.map(() => 0);
        for (const a of qAnswers) {
          const idx = a.value_numeric;
          if (idx !== null && idx >= 0 && idx < choices.length) counts[idx]++;
        }
        const top = counts
          .map((c, i) => ({ label: choices[i], count: c }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        resultsSummary += `  Top answers: ${top.map((t) => `${t.label} (${t.count})`).join(', ')}\n`;
        break;
      }
      case 'open_text': {
        const texts = qAnswers
          .filter((a) => a.value_text && a.value_text.trim())
          .map((a) => a.value_text as string);
        resultsSummary += `  ${texts.length} text responses\n`;
        // Collect for separate open-text section (cap at 20 for context budget)
        for (const t of texts.slice(0, 20)) {
          openTextResponses.push(`"${t}"`);
        }
        break;
      }
      default: {
        if (numericValues.length > 0) {
          const avg = (numericValues.reduce((s, v) => s + v, 0) / numericValues.length).toFixed(2);
          resultsSummary += `  Average: ${avg} (${numericValues.length} responses)\n`;
        }
      }
    }
  }

  // Add open-text section
  if (openTextResponses.length > 0) {
    resultsSummary += '\nOpen-text responses:\n';
    // Cap to stay within ~4000 chars total
    let charBudget = 4000 - resultsSummary.length;
    for (const text of openTextResponses) {
      if (charBudget <= 0) break;
      const entry = `- ${text}\n`;
      resultsSummary += entry;
      charBudget -= entry.length;
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze these survey results:\n\n${resultsSummary}` }],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('');

    // Parse JSON — handle markdown fences
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const summary = JSON.parse(cleaned);

    return new Response(JSON.stringify({ summary }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI analysis failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
