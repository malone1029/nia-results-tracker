import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sendTaskNotification } from '@/lib/send-task-notification';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nia-results-tracker.vercel.app';

// ── Per-user rate limiter ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 30;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

/** GET /api/tasks/[id]/comments — list comments for a task */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** POST /api/tasks/[id]/comments — add a comment, parse @mentions, send emails */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const commentBody = typeof body.body === 'string' ? body.body.trim() : '';

  if (!commentBody || commentBody.length > 2000) {
    return NextResponse.json({ error: 'Comment must be 1-2000 characters' }, { status: 400 });
  }

  // Get user display name
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('full_name')
    .eq('user_id', user.id)
    .single();

  const userName = roleRow?.full_name || user.email || 'Unknown';

  // Insert comment
  const { data: comment, error: insertError } = await supabase
    .from('task_comments')
    .insert({
      task_id: id,
      user_id: user.id,
      user_name: userName,
      body: commentBody,
    })
    .select('*')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Also log a 'commented' activity entry
  await supabase.from('task_activity_log').insert({
    task_id: id,
    user_id: user.id,
    user_name: userName,
    action: 'commented',
  });

  // ── Parse @mentions and send notifications (fire-and-forget) ──
  try {
    // Extract @Name patterns from comment body
    const mentionPattern = /@([A-Za-z]+ [A-Za-z]+)/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionPattern.exec(commentBody)) !== null) {
      mentionNames.push(match[1]);
    }

    if (mentionNames.length > 0) {
      // Look up mentioned users by full_name (case-insensitive)
      const { data: mentionedUsers } = await supabase
        .from('user_roles')
        .select('user_id, full_name, email')
        .in('full_name', mentionNames);

      if (mentionedUsers && mentionedUsers.length > 0) {
        // Get task info for the email
        const { data: task } = await supabase
          .from('process_tasks')
          .select('id, title, process_id')
          .eq('id', id)
          .single();

        let processName = 'Unknown process';
        if (task) {
          const { data: proc } = await supabase
            .from('processes')
            .select('name')
            .eq('id', task.process_id)
            .single();
          processName = proc?.name || processName;
        }

        // Insert mention records + send emails
        for (const mentioned of mentionedUsers) {
          // Don't notify yourself
          if (mentioned.user_id === user.id) continue;

          // Insert mention record
          await supabase.from('task_mentions').insert({
            comment_id: comment.id,
            task_id: id,
            mentioned_user_id: mentioned.user_id,
            mentioned_user_name: mentioned.full_name,
          });

          // Check notification preference
          const { data: pref } = await supabase
            .from('notification_preferences')
            .select('notify_on_mention')
            .eq('user_id', mentioned.user_id)
            .single();

          // Default is ON — only skip if explicitly set to false
          if (pref && pref.notify_on_mention === false) continue;

          // Send email
          if (mentioned.email) {
            await sendTaskNotification({
              to: mentioned.email,
              subject: `${userName.split(' ')[0]} mentioned you on "${task?.title || 'a task'}"`,
              recipientName: mentioned.full_name || 'there',
              taskTitle: task?.title || 'Unknown task',
              processName,
              bodyText: `<strong>${userName}</strong> mentioned you in a comment: &ldquo;${commentBody.slice(0, 200)}${commentBody.length > 200 ? '...' : ''}&rdquo;`,
              ctaLabel: 'View Comment',
              ctaUrl: `${APP_URL}/processes/${task?.process_id || 0}`,
            });
          }
        }
      }
    }
  } catch (err) {
    // Mention processing is non-critical — never fail the comment
    console.warn('[Comments] Mention processing error:', (err as Error).message);
  }

  return NextResponse.json(comment, { status: 201 });
}
