import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

const VALID_STEPS = ['start', 'charter', 'assessment', 'deep_dive', 'tasks', 'export', 'complete'];

/**
 * PATCH /api/processes/step
 * Manually update the guided_step for a process.
 * Body: { processId: number, step: string }
 */
export async function PATCH(request: Request) {
  const { processId, step } = await request.json();

  if (!processId || !step) {
    return NextResponse.json({ error: 'processId and step are required' }, { status: 400 });
  }

  if (!VALID_STEPS.includes(step)) {
    return NextResponse.json(
      { error: `Invalid step "${step}". Must be one of: ${VALID_STEPS.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('processes')
    .update({ guided_step: step })
    .eq('id', processId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, step });
}
