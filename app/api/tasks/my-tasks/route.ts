import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/** GET /api/tasks/my-tasks — all tasks assigned to the current user, across processes */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Build query — join with processes to get process_name
  let query = supabase
    .from('process_tasks')
    .select('*, processes!inner(name, owner)')
    .eq('assignee_email', user.email)
    .neq('status', 'pending'); // Exclude AI suggestions

  // Optional filters
  const priority = searchParams.get('priority');
  if (priority && ['high', 'medium', 'low'].includes(priority)) {
    query = query.eq('priority', priority);
  }

  const status = searchParams.get('status');
  if (status === 'active') {
    query = query.eq('completed', false);
  } else if (status === 'completed') {
    query = query.eq('completed', true);
  } else if (status === 'overdue') {
    query = query.eq('completed', false).lt('due_date', new Date().toISOString().slice(0, 10));
  }

  const search = searchParams.get('search');
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query.order('due_date', {
    ascending: true,
    nullsFirst: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the join — move process name to top level
  const tasks = (data || []).map(
    (row: Record<string, unknown> & { processes: { name: string; owner: string } }) => {
      const { processes, ...task } = row;
      return {
        ...task,
        process_name: processes?.name || 'Unknown',
        process_owner: processes?.owner || null,
      };
    }
  );

  return NextResponse.json(tasks);
}
