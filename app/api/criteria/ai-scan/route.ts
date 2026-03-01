import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminRole } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000,
  maxRetries: 0,
});

/**
 * POST /api/criteria/ai-scan
 * Scans all unmapped questions in batches and suggests process mappings.
 * Returns a streaming response with progress updates.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Optional tier filter from request body
  let tier: string | null = null;
  try {
    const body = await request.json();
    if (body.tier && ['excellence_builder', 'full'].includes(body.tier)) {
      tier = body.tier;
    }
  } catch {
    // No body or invalid JSON — scan all tiers
  }

  // Admin check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (!isAdminRole(roleData?.role || '')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Rate limit check
  const rl = await checkRateLimit(user.id);
  if (!rl.success) return rl.response;

  // Fetch all questions + existing mappings
  const [questionsRes, mappingsRes, processesRes] = await Promise.all([
    supabase
      .from('baldrige_questions')
      .select('*, baldrige_items(item_code, item_name, category_name)')
      .order('sort_order'),
    supabase.from('process_question_mappings').select('question_id, process_id'),
    supabase
      .from('processes')
      .select(
        'id, name, description, owner, baldrige_item, charter, adli_approach, adli_deployment, adli_learning, adli_integration'
      )
      .order('name'),
  ]);

  if (questionsRes.error || processesRes.error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  const processes = processesRes.data || [];
  if (processes.length === 0) {
    return NextResponse.json({ error: 'No processes found' }, { status: 400 });
  }

  // Find unmapped questions (no primary mapping)
  const primaryMapped = new Set(
    (mappingsRes.data || [])
      .filter((m) => true) // all mapped — we'll check coverage type client-side
      .map((m) => m.question_id)
  );

  // For "unmapped", we consider questions with NO mapping at all
  const mappedQuestionIds = new Set((mappingsRes.data || []).map((m) => m.question_id));
  const allQuestions = (questionsRes.data || []).filter(
    (q: { tier?: string }) => !tier || q.tier === tier
  );
  const unmappedQuestions = allQuestions.filter(
    (q: { id: number }) => !mappedQuestionIds.has(q.id)
  );

  if (unmappedQuestions.length === 0) {
    return NextResponse.json({ results: [], message: 'All questions are already mapped!' });
  }

  // Build compact process summaries
  const processSummaries = processes
    .map((p) => {
      const parts = [`[${p.id}] ${p.name}`];
      if (p.description) parts.push(`Desc: ${String(p.description).slice(0, 100)}`);
      if (p.baldrige_item) parts.push(`Baldrige: ${p.baldrige_item}`);
      const charter = p.charter as Record<string, unknown> | null;
      if (charter?.content) {
        parts.push(`Charter: ${String(charter.content).slice(0, 150)}`);
      }
      return parts.join(' | ');
    })
    .join('\n');

  // Process in batches of 5
  const BATCH_SIZE = 5;
  const results: {
    question_id: number;
    question_code: string;
    question_text: string;
    area_label: string;
    item_code: string;
    suggestions: {
      process_id: number;
      process_name: string;
      coverage: string;
      rationale: string;
    }[];
  }[] = [];

  for (let i = 0; i < unmappedQuestions.length; i += BATCH_SIZE) {
    const batch = unmappedQuestions.slice(i, i + BATCH_SIZE);

    const questionsText = batch
      .map((q) => {
        const item = q.baldrige_items as unknown as { item_code: string; item_name: string };
        return `[Q${q.id}] ${q.question_code} (${item.item_code} ${item.item_name}): ${q.question_text}`;
      })
      .join('\n\n');

    const systemPrompt = `You are a Baldrige Excellence Framework expert. For each question below, suggest 0-3 processes from the list that best answer it.

Return a JSON object where keys are question IDs (e.g., "Q5") and values are arrays of suggestions:
{
  "Q5": [{"process_id": 1, "process_name": "Name", "coverage": "primary", "rationale": "..."}],
  "Q7": []
}

Coverage levels: "primary" (directly addresses), "supporting" (contributes), "partial" (touches on part).
If no process fits, use an empty array. Return ONLY the JSON object.`;

    const userPrompt = `**Questions to map:**
${questionsText}

**Available processes:**
${processSummaries}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      // Parse the JSON response
      let parsed: Record<
        string,
        { process_id: number; process_name: string; coverage: string; rationale: string }[]
      > = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Skip this batch on parse error
      }

      for (const q of batch) {
        const key = `Q${q.id}`;
        const suggestions = parsed[key] || [];
        const item = q.baldrige_items as unknown as { item_code: string };
        results.push({
          question_id: q.id,
          question_code: q.question_code,
          question_text: q.question_text,
          area_label: q.area_label,
          item_code: item.item_code,
          suggestions,
        });
      }
    } catch {
      // On error, add batch questions with empty suggestions
      for (const q of batch) {
        const item = q.baldrige_items as unknown as { item_code: string };
        results.push({
          question_id: q.id,
          question_code: q.question_code,
          question_text: q.question_text,
          area_label: q.area_label,
          item_code: item.item_code,
          suggestions: [],
        });
      }
    }
  }

  return NextResponse.json({
    results,
    totalScanned: unmappedQuestions.length,
    withSuggestions: results.filter((r) => r.suggestions.length > 0).length,
    noMatch: results.filter((r) => r.suggestions.length === 0).length,
  });
}
