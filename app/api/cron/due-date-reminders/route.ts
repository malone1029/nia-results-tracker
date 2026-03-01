import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTaskNotification } from '@/lib/send-task-notification';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nia-results-tracker.vercel.app';

export const maxDuration = 60;

/**
 * GET /api/cron/due-date-reminders
 * Runs daily at 8 AM CT (14:00 UTC) via Vercel cron.
 * Sends email to assignees whose tasks are due tomorrow.
 * Respects notification_preferences.notify_on_due_approaching.
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Find tasks due tomorrow that are incomplete and have an assignee
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: tasks, error: queryError } = await supabase
    .from('process_tasks')
    .select('id, title, assignee_email, assignee_name, process_id')
    .eq('completed', false)
    .eq('due_date', tomorrowStr)
    .not('assignee_email', 'is', null);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No tasks due tomorrow' });
  }

  // Get process names for all affected tasks
  const processIds = [...new Set(tasks.map((t) => t.process_id))];
  const { data: processes } = await supabase
    .from('processes')
    .select('id, name')
    .in('id', processIds);
  const processMap = new Map((processes || []).map((p) => [p.id, p.name]));

  // Get opt-out users
  const assigneeEmails = [...new Set(tasks.map((t) => t.assignee_email))];
  // Look up user IDs by email to check preferences
  const { data: userRows } = await supabase
    .from('user_roles')
    .select('user_id, email')
    .in('email', assigneeEmails);
  const emailToUserId = new Map((userRows || []).map((u) => [u.email, u.user_id]));

  const userIds = [...emailToUserId.values()];
  const { data: prefRows } = await supabase
    .from('notification_preferences')
    .select('user_id, notify_on_due_approaching')
    .in('user_id', userIds)
    .eq('notify_on_due_approaching', false);

  const optedOutUserIds = new Set((prefRows || []).map((p) => p.user_id));

  let sent = 0;
  for (const task of tasks) {
    const userId = emailToUserId.get(task.assignee_email);
    if (userId && optedOutUserIds.has(userId)) continue;

    const processName = processMap.get(task.process_id) || 'Unknown process';

    await sendTaskNotification({
      to: task.assignee_email,
      subject: `Due tomorrow: "${task.title}"`,
      recipientName: task.assignee_name || 'there',
      taskTitle: task.title,
      processName,
      bodyText: `Your task <strong>&ldquo;${task.title}&rdquo;</strong> is due tomorrow. Take a moment to check on it.`,
      ctaLabel: 'View Task',
      ctaUrl: `${APP_URL}/processes/${task.process_id}`,
    });
    sent++;
  }

  return NextResponse.json({ sent, total: tasks.length });
}
