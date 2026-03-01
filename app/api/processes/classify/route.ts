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
 * POST /api/processes/classify
 * Uses AI to classify all processes as Key or Support.
 * Returns suggestions for admin review.
 */
export async function POST() {
  const supabase = await createSupabaseServer();

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

  // Rate limit
  const rl = await checkRateLimit(user.id);
  if (!rl.success) return rl.response;

  // Fetch all processes
  const { data: processes, error } = await supabase
    .from('processes')
    .select(
      'id, name, description, category_id, process_type, charter, adli_approach, adli_deployment, adli_learning, adli_integration, categories!inner(display_name)'
    )
    .order('name');

  if (error || !processes || processes.length === 0) {
    return NextResponse.json(
      { error: error?.message || 'No processes found' },
      { status: error ? 500 : 400 }
    );
  }

  // Build compact summaries for AI
  const processSummaries = processes.map((p) => {
    const cat = p.categories as unknown as { display_name: string };
    const parts = [`[${p.id}] ${p.name} (Category: ${cat.display_name})`];
    if (p.description) parts.push(`Description: ${String(p.description).slice(0, 150)}`);
    const charter = p.charter as Record<string, unknown> | null;
    if (charter?.content) parts.push(`Charter: ${String(charter.content).slice(0, 200)}`);
    const approach = p.adli_approach as Record<string, unknown> | null;
    if (approach?.content) parts.push(`Approach: ${String(approach.content).slice(0, 100)}`);
    return parts.join('\n  ');
  });

  // Process in batches of 10
  const BATCH_SIZE = 10;
  const results: {
    process_id: number;
    name: string;
    category: string;
    current_type: string;
    suggestion: 'key' | 'support';
    rationale: string;
  }[] = [];

  for (let i = 0; i < processSummaries.length; i += BATCH_SIZE) {
    const batchSummaries = processSummaries.slice(i, i + BATCH_SIZE);
    const batchProcesses = processes.slice(i, i + BATCH_SIZE);

    const systemPrompt = `You are a Baldrige Excellence Framework expert specializing in process classification.

In the Baldrige framework:
- **Key Work Processes** (Category 6.1) directly create value for customers and stakeholders. They are the core processes that deliver your organization's products and services. Examples: patient care delivery, student instruction, product manufacturing, service delivery.
- **Support Processes** (Category 6.2) enable key work processes to function effectively. They don't directly create value but are essential infrastructure. Examples: HR management, IT support, facilities management, financial management, strategic planning, quality improvement.

For each process below, classify it as "key" or "support" based on its name, description, charter, and category.

Return a JSON object where keys are process IDs and values have "suggestion" and "rationale":
{
  "5": {"suggestion": "key", "rationale": "Directly delivers services to member districts..."},
  "12": {"suggestion": "support", "rationale": "Enables other processes by managing technology infrastructure..."}
}

Return ONLY the JSON object. Every process must be classified.`;

    const userPrompt = `Classify these processes:\n\n${batchSummaries.join('\n\n')}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      let parsed: Record<string, { suggestion: string; rationale: string }> = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error('Failed to parse AI classification response');
      }

      for (const proc of batchProcesses) {
        const cat = proc.categories as unknown as { display_name: string };
        const result = parsed[String(proc.id)];
        results.push({
          process_id: proc.id,
          name: proc.name,
          category: cat.display_name,
          current_type: (proc.process_type as string) || 'unclassified',
          suggestion:
            result?.suggestion === 'key' || result?.suggestion === 'support'
              ? result.suggestion
              : 'support',
          rationale: result?.rationale || 'Unable to determine — defaulting to support',
        });
      }
    } catch (err) {
      console.error('AI classification batch error:', err);
      // On error, default all to support with error message
      for (const proc of batchProcesses) {
        const cat = proc.categories as unknown as { display_name: string };
        results.push({
          process_id: proc.id,
          name: proc.name,
          category: cat.display_name,
          current_type: (proc.process_type as string) || 'unclassified',
          suggestion: 'support',
          rationale: 'AI analysis failed for this batch — please review manually',
        });
      }
    }
  }

  return NextResponse.json({
    suggestions: results,
    total: results.length,
    keyCount: results.filter((r) => r.suggestion === 'key').length,
    supportCount: results.filter((r) => r.suggestion === 'support').length,
  });
}
