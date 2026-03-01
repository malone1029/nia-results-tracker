import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isSuperAdminRole } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 60_000,
  maxRetries: 0,
});

// NDJSON helper — write a JSON line to the stream
function ndjsonLine(encoder: TextEncoder, data: object): Uint8Array {
  return encoder.encode(JSON.stringify(data) + '\n');
}

/**
 * POST /api/admin/mass-adli-scan
 * Streams NDJSON progress as every process is AI-scored one by one.
 * Body: { scope: "all" | "key" | "unscored" }
 * Super admin only.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Auth check — super_admin only
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (!isSuperAdminRole(roleData?.role || '')) {
    return Response.json({ error: 'Super admin access required' }, { status: 403 });
  }

  // Rate limit
  const rl = await checkRateLimit(user.id);
  if (!rl.success) return rl.response;

  const { scope = 'all' }: { scope: 'all' | 'key' | 'unscored' } = await request.json();

  // Build query based on scope
  let query = supabase
    .from('processes')
    .select(
      `
      id, name, process_type, description,
      charter, adli_approach, adli_deployment, adli_learning, adli_integration,
      categories!inner(display_name)
    `
    )
    .order('name');

  if (scope === 'key') {
    query = query.eq('process_type', 'key');
  }

  const { data: allProcesses, error: fetchError } = await query;
  if (fetchError || !allProcesses) {
    return Response.json({ error: 'Failed to fetch processes' }, { status: 500 });
  }

  // For "unscored" scope, filter to processes without existing scores
  let processes = allProcesses;
  if (scope === 'unscored') {
    const { data: scored } = await supabase.from('process_adli_scores').select('process_id');
    const scoredIds = new Set((scored || []).map((s) => s.process_id));
    processes = allProcesses.filter((p) => !scoredIds.has(p.id));
  }

  // Set up streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const total = processes.length;
      controller.enqueue(ndjsonLine(encoder, { type: 'start', total }));

      const failed: { processId: number; processName: string; error: string }[] = [];
      const scored: { category: string; overall: number }[] = [];

      for (let i = 0; i < processes.length; i++) {
        const p = processes[i];
        const cat = p.categories as unknown as { display_name: string };

        controller.enqueue(
          ndjsonLine(encoder, {
            type: 'progress',
            current: i + 1,
            total,
            processName: p.name,
          })
        );

        try {
          // Build a compact text summary for the AI
          const charter = p.charter as Record<string, unknown> | null;
          const approach = p.adli_approach as Record<string, unknown> | null;
          const deployment = p.adli_deployment as Record<string, unknown> | null;
          const learning = p.adli_learning as Record<string, unknown> | null;
          const integration = p.adli_integration as Record<string, unknown> | null;

          const prompt = [
            `You are a Baldrige examiner. Score this process on four ADLI dimensions (0-100).`,
            `Return ONLY this JSON, nothing else:`,
            `{"approach": <n>, "deployment": <n>, "learning": <n>, "integration": <n>}`,
            ``,
            `Process: ${p.name}`,
            `Category: ${cat.display_name}`,
            charter?.content ? `Charter: ${String(charter.content).slice(0, 300)}` : '',
            approach?.content ? `Approach: ${String(approach.content).slice(0, 250)}` : '',
            deployment?.content ? `Deployment: ${String(deployment.content).slice(0, 250)}` : '',
            learning?.content ? `Learning: ${String(learning.content).slice(0, 250)}` : '',
            integration?.content ? `Integration: ${String(integration.content).slice(0, 250)}` : '',
          ]
            .filter(Boolean)
            .join('\n');

          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 128,
            messages: [{ role: 'user', content: prompt }],
          });

          const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

          // Extract JSON — model may wrap it in backticks
          const jsonMatch = text.match(/\{[\s\S]*?\}/);
          if (!jsonMatch) throw new Error('No JSON in response');

          const scores = JSON.parse(jsonMatch[0]) as {
            approach: number;
            deployment: number;
            learning: number;
            integration: number;
          };

          const overall = Math.round(
            (scores.approach + scores.deployment + scores.learning + scores.integration) / 4
          );

          // Upsert scores into DB
          await supabase.from('process_adli_scores').upsert(
            {
              process_id: p.id,
              approach_score: scores.approach,
              deployment_score: scores.deployment,
              learning_score: scores.learning,
              integration_score: scores.integration,
              overall_score: overall,
              assessed_at: new Date().toISOString(),
            },
            { onConflict: 'process_id' }
          );

          scored.push({ category: cat.display_name, overall });

          controller.enqueue(
            ndjsonLine(encoder, {
              type: 'scored',
              processId: p.id,
              processName: p.name,
              scores,
              overall,
            })
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          failed.push({ processId: p.id, processName: p.name, error: errorMsg });
          controller.enqueue(
            ndjsonLine(encoder, {
              type: 'error',
              processId: p.id,
              processName: p.name,
              error: errorMsg,
            })
          );
        }

        // Small delay to avoid hitting API rate limits on large batches
        if (i < processes.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      // Build category averages from scored results
      const categoryMap = new Map<string, number[]>();
      for (const s of scored) {
        if (!categoryMap.has(s.category)) categoryMap.set(s.category, []);
        categoryMap.get(s.category)!.push(s.overall);
      }
      const avgByCategory = Array.from(categoryMap.entries()).map(([category, scores]) => ({
        category,
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }));

      controller.enqueue(
        ndjsonLine(encoder, {
          type: 'complete',
          summary: {
            total,
            scored: scored.length,
            failed: failed.length,
            failedProcesses: failed,
            avgByCategory,
          },
        })
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
