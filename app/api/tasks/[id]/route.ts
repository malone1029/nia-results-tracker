import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAsanaToken, asanaFetch } from '@/lib/asana';
import { PDCA_SECTION_VALUES, PDCA_SECTIONS } from '@/lib/pdca';
import { sendTaskNotification } from '@/lib/send-task-notification';
import { computeNextDueDate, validateRecurrenceRule } from '@/lib/recurrence';
import type { PdcaSection, RecurrenceRule } from '@/lib/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nia-results-tracker.vercel.app';

// ── Simple per-user rate limiter (protects Asana's 150 req/min limit) ──
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

/**
 * PATCH /api/tasks/[id] — Update a task with Asana write-back.
 *
 * For Asana-origin tasks: pushes changes to Asana API first,
 * then updates Supabase on success. On Asana failure, returns 502
 * and does NOT update Supabase (strict source of truth).
 *
 * For Hub tasks: updates Supabase directly.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
  }

  const body = await request.json();
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Rate limit: 30 updates/min per user
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  // Fetch the task (includes fields needed for activity log diffs)
  const { data: task, error: fetchError } = await supabase
    .from('process_tasks')
    .select(
      'id, title, origin, asana_task_gid, process_id, priority, assignee_name, assignee_email, completed, recurrence_rule, pdca_section, description, assignee_asana_gid, start_date, due_date'
    )
    .eq('id', id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Build Supabase update object from allowed fields
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) updates.description = body.description;
  if (body.start_date !== undefined) updates.start_date = body.start_date;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.assignee_name !== undefined) updates.assignee_name = body.assignee_name;
  if (body.assignee_email !== undefined) updates.assignee_email = body.assignee_email;
  if (body.assignee_asana_gid !== undefined) updates.assignee_asana_gid = body.assignee_asana_gid;

  // Sort order (used by drag-and-drop reorder)
  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== 'number' || body.sort_order < 0) {
      return NextResponse.json(
        { error: 'sort_order must be a non-negative number' },
        { status: 400 }
      );
    }
    updates.sort_order = body.sort_order;
  }

  // PDCA section change (used by drag-and-drop between sections)
  if (body.pdca_section !== undefined) {
    if (!PDCA_SECTION_VALUES.includes(body.pdca_section)) {
      return NextResponse.json(
        { error: `Invalid pdca_section. Must be one of: ${PDCA_SECTION_VALUES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.pdca_section = body.pdca_section;
    // Update the displayed section name to match
    updates.asana_section_name = PDCA_SECTIONS[body.pdca_section as PdcaSection].label;
  }

  // Priority (Hub-only — not synced to Asana)
  if (body.priority !== undefined) {
    if (!['high', 'medium', 'low'].includes(body.priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be one of: high, medium, low' },
        { status: 400 }
      );
    }
    updates.priority = body.priority;
  }

  // Recurrence rule (Hub-only — not synced to Asana)
  if (body.recurrence_rule !== undefined) {
    if (body.recurrence_rule === null) {
      updates.recurrence_rule = null;
    } else {
      const ruleError = validateRecurrenceRule(body.recurrence_rule);
      if (ruleError) {
        return NextResponse.json({ error: ruleError }, { status: 400 });
      }
      updates.recurrence_rule = body.recurrence_rule;
    }
  }

  // Auto-derive status and completed_at from completed boolean
  if (body.completed !== undefined) {
    updates.completed = body.completed;
    if (body.completed) {
      updates.completed_at = new Date().toISOString();
      updates.status = 'completed';
    } else {
      updates.completed_at = null;
      updates.status = 'active';
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // For Asana-origin tasks: push to Asana first
  if (task.origin === 'asana' && task.asana_task_gid) {
    const token = await getAsanaToken(user.id);
    if (!token) {
      return NextResponse.json(
        {
          error: 'asana_not_connected',
          message: 'Asana not connected. Reconnect in Settings.',
        },
        { status: 401 }
      );
    }

    // Map Hub field names to Asana API field names
    const asanaData: Record<string, unknown> = {};
    if (body.title !== undefined) asanaData.name = body.title;
    if (body.description !== undefined) asanaData.notes = body.description;
    if (body.start_date !== undefined) asanaData.start_on = body.start_date;
    if (body.due_date !== undefined) asanaData.due_on = body.due_date;
    if (body.completed !== undefined) asanaData.completed = body.completed;
    if (body.assignee_asana_gid !== undefined) asanaData.assignee = body.assignee_asana_gid;

    if (Object.keys(asanaData).length > 0) {
      try {
        await asanaFetch(token, `/tasks/${task.asana_task_gid}`, {
          method: 'PUT',
          body: JSON.stringify({ data: asanaData }),
        });
      } catch (err) {
        return NextResponse.json(
          {
            error: 'asana_sync_failed',
            message: (err as Error).message || "Couldn't update in Asana. Please try again.",
          },
          { status: 502 }
        );
      }
    }

    // Move to new Asana section when pdca_section changes
    if (body.pdca_section !== undefined) {
      try {
        // Look up the process's Asana project
        const { data: proc } = await supabase
          .from('processes')
          .select('asana_project_gid')
          .eq('id', task.process_id)
          .single();

        if (proc?.asana_project_gid) {
          // Fetch sections from the Asana project
          const sectionsRes = await asanaFetch(
            token,
            `/projects/${proc.asana_project_gid}/sections?opt_fields=name`
          );
          const targetLabel = PDCA_SECTIONS[body.pdca_section as PdcaSection].label.toLowerCase();
          const targetSection = sectionsRes.data?.find(
            (s: { name: string; gid: string }) => s.name.toLowerCase() === targetLabel
          );

          if (targetSection) {
            await asanaFetch(token, `/sections/${targetSection.gid}/addTask`, {
              method: 'POST',
              body: JSON.stringify({ data: { task: task.asana_task_gid } }),
            });
            updates.asana_section_gid = targetSection.gid;
          }
        }
      } catch {
        // Section move is best-effort — don't block the update
        console.warn(`[PATCH /api/tasks/${id}] Asana section move failed (non-blocking)`);
      }
    }

    // Mark when we last synced
    updates.last_synced_at = new Date().toISOString();
  }

  // Update Supabase
  const { error: updateError } = await supabase.from('process_tasks').update(updates).eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // ── Dependency check on completion (soft warning) ──
  let blockerWarning: { warning: string; blockerCount: number } | null = null;
  if (body.completed === true && !task.completed) {
    try {
      // Get all tasks this task depends on
      const { data: deps } = await supabase
        .from('task_dependencies')
        .select('depends_on_task_id')
        .eq('task_id', id);

      if (deps && deps.length > 0) {
        const depIds = deps.map((d) => d.depends_on_task_id);
        const { data: depTasks } = await supabase
          .from('process_tasks')
          .select('id, completed')
          .in('id', depIds);

        const incompleteCount = (depTasks || []).filter((t) => !t.completed).length;
        if (incompleteCount > 0) {
          blockerWarning = {
            warning: 'completed_with_blockers',
            blockerCount: incompleteCount,
          };
        }
      }
    } catch {
      // Non-critical — don't block the update
    }
  }

  // ── Recurrence spawn on completion ──
  let spawnedTaskId: number | null = null;
  if (body.completed === true && !task.completed && task.recurrence_rule) {
    try {
      const rule = task.recurrence_rule as RecurrenceRule;
      const nextDueDate = computeNextDueDate(new Date().toISOString(), rule);

      if (nextDueDate) {
        // Check if a next occurrence already exists (prevent double-spawn)
        const parentId =
          ((task as Record<string, unknown>).recurring_parent_id as number | null) || task.id;
        const { data: existing } = await supabase
          .from('process_tasks')
          .select('id')
          .eq('recurring_parent_id', parentId)
          .eq('completed', false)
          .limit(1);

        if (!existing || existing.length === 0) {
          // Spawn new recurring task
          const { data: maxRow } = await supabase
            .from('process_tasks')
            .select('sort_order')
            .eq('process_id', task.process_id)
            .eq('pdca_section', task.pdca_section)
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

          const { data: newTask } = await supabase
            .from('process_tasks')
            .insert({
              process_id: task.process_id,
              title: task.title,
              description: task.description,
              pdca_section: task.pdca_section,
              assignee_name: task.assignee_name,
              assignee_email: task.assignee_email,
              assignee_asana_gid: task.assignee_asana_gid,
              due_date: nextDueDate,
              start_date: null,
              priority: ((task as Record<string, unknown>).priority as string) || 'medium',
              recurrence_rule: task.recurrence_rule,
              recurring_parent_id: parentId,
              origin: task.origin === 'asana' ? 'hub_manual' : task.origin,
              source: 'user_created',
              status: 'active',
              sort_order: (maxRow?.sort_order ?? 0) + 1000,
            })
            .select('id')
            .single();

          if (newTask) {
            spawnedTaskId = newTask.id;
          }
        }
      }
    } catch (err) {
      console.warn('[PATCH /api/tasks] Recurrence spawn error:', (err as Error).message);
    }
  }

  // ── Activity logging (best-effort, non-blocking) ──
  try {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();
    const userName = roleRow?.full_name || user.email || 'Unknown';

    const activities: {
      task_id: number;
      user_id: string;
      user_name: string;
      action: string;
      detail?: Record<string, unknown>;
    }[] = [];

    if (body.completed === true && !task.completed) {
      activities.push({ task_id: id, user_id: user.id, user_name: userName, action: 'completed' });
    } else if (body.completed === false && task.completed) {
      activities.push({
        task_id: id,
        user_id: user.id,
        user_name: userName,
        action: 'uncompleted',
      });
    }

    if (body.priority !== undefined && body.priority !== task.priority) {
      activities.push({
        task_id: id,
        user_id: user.id,
        user_name: userName,
        action: 'priority_changed',
        detail: { from: task.priority, to: body.priority },
      });
    }

    if (body.assignee_name !== undefined && body.assignee_name !== task.assignee_name) {
      activities.push({
        task_id: id,
        user_id: user.id,
        user_name: userName,
        action: 'reassigned',
        detail: {
          from: task.assignee_name || 'Unassigned',
          to: body.assignee_name || 'Unassigned',
        },
      });
    }

    if (body.recurrence_rule !== undefined) {
      activities.push({
        task_id: id,
        user_id: user.id,
        user_name: userName,
        action: 'recurrence_set',
        detail: body.recurrence_rule ? { rule: body.recurrence_rule } : { removed: true },
      });
    }

    if (activities.length > 0) {
      await supabase.from('task_activity_log').insert(activities);
    }
  } catch {
    // Activity logging is non-critical — don't fail the request
  }

  // ── Email notifications (fire-and-forget) ──
  try {
    // Get task info for emails (need title + process name)
    const { data: taskInfo } = await supabase
      .from('process_tasks')
      .select('title, process_id, assignee_email, assignee_name')
      .eq('id', id)
      .single();

    if (taskInfo) {
      const { data: updaterRole } = await supabase
        .from('user_roles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .single();
      const updaterDisplayName = updaterRole?.full_name || user.email || 'Someone';
      const updaterEmail = updaterRole?.email || user.email;

      const { data: proc } = await supabase
        .from('processes')
        .select('name')
        .eq('id', taskInfo.process_id)
        .single();
      const processName = proc?.name || 'Unknown process';

      // Assignment email: when assignee_email changes to someone other than the updater
      if (
        body.assignee_email !== undefined &&
        body.assignee_email !== task.assignee_email &&
        body.assignee_email &&
        body.assignee_email !== updaterEmail
      ) {
        // Check recipient's preference
        const { data: assigneeUser } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('email', body.assignee_email)
          .single();

        let shouldSend = true;
        if (assigneeUser) {
          const { data: pref } = await supabase
            .from('notification_preferences')
            .select('notify_on_assignment')
            .eq('user_id', assigneeUser.user_id)
            .single();
          if (pref && pref.notify_on_assignment === false) shouldSend = false;
        }

        if (shouldSend) {
          await sendTaskNotification({
            to: body.assignee_email,
            subject: `You've been assigned: "${taskInfo.title}"`,
            recipientName: body.assignee_name || 'there',
            taskTitle: taskInfo.title,
            processName,
            bodyText: `<strong>${updaterDisplayName}</strong> assigned you to this task.`,
            ctaLabel: 'View Task',
            ctaUrl: `${APP_URL}/processes/${taskInfo.process_id}`,
          });
        }
      }

      // Completion email: when task completed and assignee differs from completer
      if (
        body.completed === true &&
        !task.completed &&
        taskInfo.assignee_email &&
        taskInfo.assignee_email !== updaterEmail
      ) {
        // Check recipient's preference
        const { data: assigneeUser } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('email', taskInfo.assignee_email)
          .single();

        let shouldSend = true;
        if (assigneeUser) {
          const { data: pref } = await supabase
            .from('notification_preferences')
            .select('notify_on_completion')
            .eq('user_id', assigneeUser.user_id)
            .single();
          if (pref && pref.notify_on_completion === false) shouldSend = false;
        }

        if (shouldSend) {
          await sendTaskNotification({
            to: taskInfo.assignee_email,
            subject: `Task completed: "${taskInfo.title}"`,
            recipientName: taskInfo.assignee_name || 'there',
            taskTitle: taskInfo.title,
            processName,
            bodyText: `<strong>${updaterDisplayName}</strong> marked this task as complete.`,
            ctaLabel: 'View Task',
            ctaUrl: `${APP_URL}/processes/${taskInfo.process_id}`,
          });
        }
      }
    }
  } catch (err) {
    // Email notifications are non-critical — never fail the request
    console.warn('[PATCH /api/tasks] Notification error:', (err as Error).message);
  }

  return NextResponse.json({
    success: true,
    ...(blockerWarning || {}),
    ...(spawnedTaskId ? { spawnedTaskId } : {}),
  });
}

/**
 * DELETE /api/tasks/[id] — Delete a task with Asana cleanup.
 *
 * If the task has an asana_task_gid (any origin), deletes from Asana first.
 * On Asana failure, returns 502 and does NOT delete from Supabase (strict sync).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  // Fetch task to check for asana_task_gid
  const { data: task, error: fetchError } = await supabase
    .from('process_tasks')
    .select('id, asana_task_gid')
    .eq('id', id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // If task has an Asana GID, delete from Asana first (strict sync)
  if (task.asana_task_gid) {
    const token = await getAsanaToken(user.id);
    if (!token) {
      return NextResponse.json(
        {
          error: 'asana_not_connected',
          message: 'Asana not connected. Reconnect in Settings to delete this task.',
        },
        { status: 502 }
      );
    }

    try {
      await asanaFetch(token, `/tasks/${task.asana_task_gid}`, {
        method: 'DELETE',
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: 'asana_delete_failed',
          message:
            (err as Error).message ||
            "Couldn't delete from Asana. Try again or disconnect Asana first.",
        },
        { status: 502 }
      );
    }
  }

  // Delete from Supabase
  const { error: deleteError } = await supabase.from('process_tasks').delete().eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
