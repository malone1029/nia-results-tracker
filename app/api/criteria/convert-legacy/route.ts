import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminRole } from '@/lib/auth-helpers';

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000,
  maxRetries: 0,
});

/**
 * POST /api/criteria/convert-legacy
 * One-time conversion: reads processes with baldrige_connections JSONB data
 * and creates process_question_mappings rows by matching to EB questions.
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

  // Fetch processes with non-null baldrige_connections
  const { data: processes } = await supabase
    .from('processes')
    .select('id, name, baldrige_connections')
    .not('baldrige_connections', 'is', null);

  if (!processes || processes.length === 0) {
    return NextResponse.json({
      message: 'No processes with legacy Baldrige connections found',
      converted: 0,
    });
  }

  // Filter to those that actually have questions_addressed or evidence_by_dimension
  const withContent = processes.filter((p) => {
    const bc = p.baldrige_connections as Record<string, unknown> | null;
    if (!bc) return false;
    const questions = bc.questions_addressed as string[] | undefined;
    const evidence = bc.evidence_by_dimension as Record<string, string> | undefined;
    const content = bc.content as string | undefined;
    return (
      (questions && questions.length > 0) ||
      (evidence && Object.values(evidence).some(Boolean)) ||
      (content && content.trim().length > 0)
    );
  });

  if (withContent.length === 0) {
    return NextResponse.json({
      message: 'No processes with meaningful Baldrige connections found',
      converted: 0,
    });
  }

  // Fetch all EB questions for matching
  const { data: ebQuestions } = await supabase
    .from('baldrige_questions')
    .select(
      'id, question_code, area_label, question_text, baldrige_items!inner(item_code, item_name)'
    )
    .eq('tier', 'excellence_builder')
    .order('sort_order');

  if (!ebQuestions || ebQuestions.length === 0) {
    return NextResponse.json(
      { error: 'No Excellence Builder questions found. Run migration-018 and seed first.' },
      { status: 400 }
    );
  }

  // Fetch existing mappings to avoid duplicates
  const { data: existingMappings } = await supabase
    .from('process_question_mappings')
    .select('process_id, question_id');

  const existingSet = new Set(
    (existingMappings || []).map((m) => `${m.process_id}-${m.question_id}`)
  );

  // Build EB question reference for AI
  const questionRef = ebQuestions
    .map((q) => {
      const item = q.baldrige_items as unknown as { item_code: string; item_name: string };
      return `[${q.id}] ${q.question_code} (${item.item_code} ${item.item_name}): ${q.question_text}`;
    })
    .join('\n');

  // Process each process with legacy data
  const results: {
    process_id: number;
    process_name: string;
    mappings_created: number;
    unmatched: string[];
  }[] = [];

  for (const proc of withContent) {
    const bc = proc.baldrige_connections as Record<string, unknown>;
    const questions = (bc.questions_addressed as string[] | undefined) || [];
    const evidence = bc.evidence_by_dimension as Record<string, string> | undefined;
    const content = bc.content as string | undefined;

    // Build context for AI
    const contextParts: string[] = [];
    if (questions.length > 0) {
      contextParts.push(`Questions addressed:\n${questions.map((q) => `- ${q}`).join('\n')}`);
    }
    if (evidence) {
      const dims = Object.entries(evidence).filter(([, v]) => v);
      if (dims.length > 0) {
        contextParts.push(`ADLI Evidence:\n${dims.map(([k, v]) => `${k}: ${v}`).join('\n')}`);
      }
    }
    if (content) {
      contextParts.push(`Full content:\n${content.slice(0, 2000)}`);
    }

    const systemPrompt = `You are a Baldrige Excellence Framework expert. Match this process's legacy Baldrige connections to specific Excellence Builder questions.

Return a JSON array of matches:
[{"question_id": 123, "coverage": "primary", "rationale": "..."}]

Coverage levels: "primary" (directly addresses), "supporting" (contributes), "partial" (touches on part).
Return ONLY valid JSON. If no matches, return [].`;

    const userPrompt = `**Process: ${proc.name}** (ID: ${proc.id})

**Legacy Baldrige Connections:**
${contextParts.join('\n\n')}

**Available Excellence Builder Questions:**
${questionRef}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      let matches: { question_id: number; coverage: string; rationale: string }[] = [];
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) matches = JSON.parse(jsonMatch[0]);
      } catch {
        // Parse error — skip
      }

      // Create mappings
      let created = 0;
      const unmatched: string[] = [];

      for (const match of matches) {
        const key = `${proc.id}-${match.question_id}`;
        if (existingSet.has(key)) continue; // Skip duplicate

        const { error } = await supabase.from('process_question_mappings').insert({
          process_id: proc.id,
          question_id: match.question_id,
          coverage: match.coverage,
          notes: match.rationale,
          mapped_by: 'ai_confirmed',
        });

        if (!error) {
          created++;
          existingSet.add(key); // Track to prevent re-creation in same run
        }
      }

      // Track any legacy questions that didn't match
      for (const q of questions) {
        const matched = matches.some((m) => {
          const ebQ = ebQuestions.find((eq) => eq.id === m.question_id);
          return (
            ebQ && q.toLowerCase().includes(ebQ.question_code.replace('EB-', '').toLowerCase())
          );
        });
        if (!matched) unmatched.push(q);
      }

      results.push({
        process_id: proc.id,
        process_name: proc.name,
        mappings_created: created,
        unmatched,
      });
    } catch {
      results.push({
        process_id: proc.id,
        process_name: proc.name,
        mappings_created: 0,
        unmatched: questions,
      });
    }
  }

  const totalCreated = results.reduce((s, r) => s + r.mappings_created, 0);
  const totalUnmatched = results.reduce((s, r) => s + r.unmatched.length, 0);

  return NextResponse.json({
    message: `Converted ${withContent.length} processes, created ${totalCreated} mappings, ${totalUnmatched} unmatched`,
    results,
    totalProcesses: withContent.length,
    totalMappingsCreated: totalCreated,
    totalUnmatched,
  });
}
