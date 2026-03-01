import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServer } from '@/lib/supabase-server';

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

const SYSTEM_PROMPT = `You are a survey design expert. Generate survey questions as a JSON array based on the user's description.

## Rules
- Return ONLY a valid JSON array of question objects — no explanation, no markdown fences
- Each question object must have these fields:
  - "question_text": string (the question)
  - "question_type": one of "rating", "yes_no", "nps", "multiple_choice", "checkbox", "open_text", "matrix"
  - "rating_scale_max": number (default 5, only meaningful for "rating")
  - "options": object — type-specific:
    - rating: { "labels": ["Strongly Disagree", ..., "Strongly Agree"] } — always provide labels matching rating_scale_max
    - multiple_choice/checkbox: { "choices": ["Option A", "Option B", ...] }
    - open_text: { "variant": "short" or "long" }
    - matrix: { "rows": ["Row 1", ...], "columns": ["Col 1", ...] }
    - nps/yes_no: {}
  - "is_required": boolean
  - "help_text": string (brief clarification, "" if not needed)
  - "section_label": string ("" for no section break, or a label like "Background" to start a new section)

## Best Practices
- Use a mix of question types for engagement (don't make it all ratings)
- Start with easier questions, save complex ones for later
- Include at least 1 NPS question for overall satisfaction
- End with an open-text question for free-form feedback
- Group related questions with section_label on the first question of each group
- Keep surveys to 5-12 questions unless the user requests more
- For rating scales, use 5-point by default with descriptive labels
- Mark demographic and open-text questions as not required

## Process Context
If process information is provided, tailor questions to measure that specific process's effectiveness, stakeholder satisfaction, and improvement areas.`;

// POST — generate survey questions from a description
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const { description, processId } = body;

  if (!description || typeof description !== 'string') {
    return new Response(JSON.stringify({ error: 'description is required' }), { status: 400 });
  }

  // Optionally fetch process context
  let processContext = '';
  if (processId) {
    const { data: proc } = await supabase
      .from('processes')
      .select('name, description, owner, charter')
      .eq('id', Number(processId))
      .single();

    if (proc) {
      processContext = `\n\nProcess context:\n- Name: ${proc.name}\n- Description: ${proc.description || 'N/A'}\n- Owner: ${proc.owner || 'N/A'}`;
      if (proc.charter?.purpose) {
        processContext += `\n- Purpose: ${(proc.charter as Record<string, string>).purpose}`;
      }
    }
  }

  const userMessage = `Generate a survey for: ${description}${processContext}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('');

    // Parse — handle both clean JSON and markdown-fenced JSON
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const questions = JSON.parse(cleaned);

    if (!Array.isArray(questions)) {
      return new Response(JSON.stringify({ error: 'AI returned invalid format' }), { status: 500 });
    }

    return new Response(JSON.stringify({ questions }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
