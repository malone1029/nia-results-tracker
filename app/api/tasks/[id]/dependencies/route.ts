import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/tasks/[id]/dependencies
 * Returns { blockedBy: [...], blocking: [...] } with related task title + completed status.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // Tasks this task depends on (blockers)
  const { data: blockedByRows } = await supabase
    .from('task_dependencies')
    .select('id, depends_on_task_id, created_at')
    .eq('task_id', id);

  // Tasks that depend on this task
  const { data: blockingRows } = await supabase
    .from('task_dependencies')
    .select('id, task_id, created_at')
    .eq('depends_on_task_id', id);

  // Collect all related task IDs for a single batch lookup
  const relatedIds = new Set<number>();
  for (const r of blockedByRows || []) relatedIds.add(r.depends_on_task_id);
  for (const r of blockingRows || []) relatedIds.add(r.task_id);

  // Fetch titles + completed status in one query
  const taskMap = new Map<number, { title: string; completed: boolean }>();
  if (relatedIds.size > 0) {
    const { data: relatedTasks } = await supabase
      .from('process_tasks')
      .select('id, title, completed')
      .in('id', Array.from(relatedIds));

    for (const t of relatedTasks || []) {
      taskMap.set(t.id, { title: t.title, completed: t.completed });
    }
  }

  const blockedBy = (blockedByRows || []).map((r) => ({
    dependency_id: r.id,
    task_id: r.depends_on_task_id,
    title: taskMap.get(r.depends_on_task_id)?.title || 'Unknown',
    completed: taskMap.get(r.depends_on_task_id)?.completed || false,
    created_at: r.created_at,
  }));

  const blocking = (blockingRows || []).map((r) => ({
    dependency_id: r.id,
    task_id: r.task_id,
    title: taskMap.get(r.task_id)?.title || 'Unknown',
    completed: taskMap.get(r.task_id)?.completed || false,
    created_at: r.created_at,
  }));

  return NextResponse.json({ blockedBy, blocking });
}

/**
 * POST /api/tasks/[id]/dependencies
 * Body: { depends_on_task_id: number }
 * Validates same process, checks for circular dependencies (BFS, max depth 10).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { depends_on_task_id } = await request.json();
  if (!depends_on_task_id || typeof depends_on_task_id !== 'number') {
    return NextResponse.json(
      { error: 'depends_on_task_id is required and must be a number' },
      { status: 400 }
    );
  }

  if (id === depends_on_task_id) {
    return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
  }

  // Verify both tasks exist and are in the same process
  const { data: tasks } = await supabase
    .from('process_tasks')
    .select('id, process_id, title')
    .in('id', [id, depends_on_task_id]);

  if (!tasks || tasks.length !== 2) {
    return NextResponse.json({ error: 'One or both tasks not found' }, { status: 404 });
  }

  const taskA = tasks.find((t) => t.id === id);
  const taskB = tasks.find((t) => t.id === depends_on_task_id);

  if (taskA!.process_id !== taskB!.process_id) {
    return NextResponse.json({ error: 'Tasks must be in the same process' }, { status: 400 });
  }

  // Circular dependency check (BFS from depends_on_task_id, max depth 10)
  // If depends_on_task_id eventually depends on id, it's circular
  const visited = new Set<number>();
  const queue: number[] = [depends_on_task_id];
  let depth = 0;

  while (queue.length > 0 && depth < 10) {
    const batch = [...queue];
    queue.length = 0;
    depth++;

    const { data: deps } = await supabase
      .from('task_dependencies')
      .select('depends_on_task_id')
      .in('task_id', batch);

    for (const d of deps || []) {
      if (d.depends_on_task_id === id) {
        return NextResponse.json(
          { error: 'This would create a circular dependency' },
          { status: 400 }
        );
      }
      if (!visited.has(d.depends_on_task_id)) {
        visited.add(d.depends_on_task_id);
        queue.push(d.depends_on_task_id);
      }
    }
  }

  // Insert the dependency
  const { error: insertError } = await supabase.from('task_dependencies').insert({
    task_id: id,
    depends_on_task_id,
    created_by: user.id,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'This dependency already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Log activity (best-effort)
  try {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();
    const userName = roleRow?.full_name || user.email || 'Unknown';

    await supabase.from('task_activity_log').insert({
      task_id: id,
      user_id: user.id,
      user_name: userName,
      action: 'dependency_added',
      detail: { depends_on: depends_on_task_id, depends_on_title: taskB!.title },
    });
  } catch {
    // Non-critical
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/tasks/[id]/dependencies
 * Body: { dependency_id: number }
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { dependency_id } = await request.json();
  if (!dependency_id) {
    return NextResponse.json({ error: 'dependency_id is required' }, { status: 400 });
  }

  // Fetch dependency details for activity log before deleting
  const { data: dep } = await supabase
    .from('task_dependencies')
    .select('id, task_id, depends_on_task_id')
    .eq('id', dependency_id)
    .single();

  const { error: deleteError } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('id', dependency_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Log activity (best-effort)
  if (dep) {
    try {
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      const userName = roleRow?.full_name || user.email || 'Unknown';

      await supabase.from('task_activity_log').insert({
        task_id: dep.task_id,
        user_id: user.id,
        user_name: userName,
        action: 'dependency_removed',
        detail: { removed_dependency_on: dep.depends_on_task_id },
      });
    } catch {
      // Non-critical
    }
  }

  return NextResponse.json({ success: true });
}
