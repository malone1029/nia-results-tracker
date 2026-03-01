import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/** GET /api/tasks/[id]/activity — list activity for a task */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('task_activity_log')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
