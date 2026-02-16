import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

// ── Per-user rate limiter (stricter for bulk ops) ─────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_BULK_OPS = 10;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_BULK_OPS) return false;
  entry.count++;
  return true;
}

const MAX_BATCH_SIZE = 50;

/**
 * PATCH /api/tasks/bulk — Bulk update tasks.
 *
 * Body: { taskIds: number[], fields: { completed?, priority?, assignee_name?, assignee_email?, assignee_asana_gid?, due_date? } }
 * Response: { success, updated, failed, asanaErrors? }
 */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many bulk operations. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { taskIds, fields } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds must be a non-empty array" }, { status: 400 });
  }
  if (taskIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `Maximum ${MAX_BATCH_SIZE} tasks per bulk operation` }, { status: 400 });
  }
  if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "fields must contain at least one field to update" }, { status: 400 });
  }

  // Validate allowed fields
  const allowedFields = ["completed", "priority", "assignee_name", "assignee_email", "assignee_asana_gid", "due_date"];
  for (const key of Object.keys(fields)) {
    if (!allowedFields.includes(key)) {
      return NextResponse.json({ error: `Field "${key}" is not allowed in bulk update` }, { status: 400 });
    }
  }

  // Validate priority value
  if (fields.priority !== undefined && !["high", "medium", "low"].includes(fields.priority)) {
    return NextResponse.json({ error: "Invalid priority value" }, { status: 400 });
  }

  // Build Supabase update object
  const updates: Record<string, unknown> = {};
  if (fields.completed !== undefined) {
    updates.completed = fields.completed;
    updates.completed_at = fields.completed ? new Date().toISOString() : null;
    updates.status = fields.completed ? "completed" : "active";
  }
  if (fields.priority !== undefined) updates.priority = fields.priority;
  if (fields.assignee_name !== undefined) updates.assignee_name = fields.assignee_name;
  if (fields.assignee_email !== undefined) updates.assignee_email = fields.assignee_email;
  if (fields.assignee_asana_gid !== undefined) updates.assignee_asana_gid = fields.assignee_asana_gid;
  if (fields.due_date !== undefined) updates.due_date = fields.due_date;

  // Fetch tasks to separate Hub vs Asana-origin
  const { data: tasks, error: fetchError } = await supabase
    .from("process_tasks")
    .select("id, origin, asana_task_gid")
    .in("id", taskIds);

  if (fetchError || !tasks) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const asanaTasks = tasks.filter((t) => t.origin === "asana" && t.asana_task_gid);
  const hubTaskIds = tasks.filter((t) => t.origin !== "asana" || !t.asana_task_gid).map((t) => t.id);

  let updated = 0;
  let failed = 0;
  const asanaErrors: string[] = [];

  // ── Update Hub tasks in batch ──
  if (hubTaskIds.length > 0) {
    const { error: updateError } = await supabase
      .from("process_tasks")
      .update(updates)
      .in("id", hubTaskIds);

    if (updateError) {
      failed += hubTaskIds.length;
    } else {
      updated += hubTaskIds.length;
    }
  }

  // ── Update Asana tasks individually (Asana has no bulk API) ──
  if (asanaTasks.length > 0) {
    const token = await getAsanaToken(user.id);

    if (!token) {
      // Can't sync to Asana — update Supabase only for these tasks too
      const asanaIds = asanaTasks.map((t) => t.id);
      const { error: updateError } = await supabase
        .from("process_tasks")
        .update(updates)
        .in("id", asanaIds);

      if (updateError) {
        failed += asanaIds.length;
      } else {
        updated += asanaIds.length;
      }
      asanaErrors.push("Asana not connected — updated locally only");
    } else {
      // Build Asana API field mapping
      const asanaData: Record<string, unknown> = {};
      if (fields.completed !== undefined) asanaData.completed = fields.completed;
      if (fields.due_date !== undefined) asanaData.due_on = fields.due_date;
      if (fields.assignee_asana_gid !== undefined) asanaData.assignee = fields.assignee_asana_gid;

      const results = await Promise.allSettled(
        asanaTasks.map(async (task) => {
          // Push to Asana if there are Asana-mapped fields
          if (Object.keys(asanaData).length > 0) {
            await asanaFetch(token, `/tasks/${task.asana_task_gid}`, {
              method: "PUT",
              body: JSON.stringify({ data: asanaData }),
            });
          }

          // Update Supabase
          const { error: updateError } = await supabase
            .from("process_tasks")
            .update({ ...updates, last_synced_at: new Date().toISOString() })
            .eq("id", task.id);

          if (updateError) throw new Error(`Supabase update failed for task ${task.id}`);
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          updated++;
        } else {
          failed++;
          asanaErrors.push(result.reason?.message || "Unknown Asana error");
        }
      }
    }
  }

  // ── Activity log (best-effort) ──
  try {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();
    const userName = roleRow?.full_name || user.email || "Unknown";

    // Determine action type
    let action = "status_changed";
    const detail: Record<string, unknown> = { bulk: true, count: taskIds.length };

    if (fields.completed !== undefined) {
      action = fields.completed ? "completed" : "uncompleted";
    } else if (fields.priority !== undefined) {
      action = "priority_changed";
      detail.to = fields.priority;
    } else if (fields.assignee_name !== undefined) {
      action = "reassigned";
      detail.to = fields.assignee_name || "Unassigned";
    }

    const activities = taskIds.map((taskId: number) => ({
      task_id: taskId,
      user_id: user.id,
      user_name: userName,
      action,
      detail,
    }));

    await supabase.from("task_activity_log").insert(activities);
  } catch {
    // Non-critical
  }

  return NextResponse.json({
    success: true,
    updated,
    failed,
    ...(asanaErrors.length > 0 ? { asanaErrors } : {}),
  });
}

/**
 * DELETE /api/tasks/bulk — Bulk delete tasks.
 *
 * Body: { taskIds: number[] }
 * Response: { success, deleted, failed, asanaErrors? }
 */
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many bulk operations. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { taskIds } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds must be a non-empty array" }, { status: 400 });
  }
  if (taskIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `Maximum ${MAX_BATCH_SIZE} tasks per bulk delete` }, { status: 400 });
  }

  // Fetch tasks to check for Asana GIDs
  const { data: tasks, error: fetchError } = await supabase
    .from("process_tasks")
    .select("id, asana_task_gid")
    .in("id", taskIds);

  if (fetchError || !tasks) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const asanaTasks = tasks.filter((t) => t.asana_task_gid);
  const hubOnlyIds = tasks.filter((t) => !t.asana_task_gid).map((t) => t.id);

  let deleted = 0;
  let failed = 0;
  const asanaErrors: string[] = [];

  // ── Delete Asana tasks individually first ──
  if (asanaTasks.length > 0) {
    const token = await getAsanaToken(user.id);

    const results = await Promise.allSettled(
      asanaTasks.map(async (task) => {
        if (token && task.asana_task_gid) {
          try {
            await asanaFetch(token, `/tasks/${task.asana_task_gid}`, {
              method: "DELETE",
            });
          } catch (err) {
            // Log but still delete from Supabase
            asanaErrors.push(
              `Asana delete failed for task ${task.id}: ${(err as Error).message}`
            );
          }
        }

        // Delete from Supabase regardless
        const { error: deleteError } = await supabase
          .from("process_tasks")
          .delete()
          .eq("id", task.id);

        if (deleteError) throw new Error(`Supabase delete failed for task ${task.id}`);
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        deleted++;
      } else {
        failed++;
      }
    }
  }

  // ── Delete Hub-only tasks in batch ──
  if (hubOnlyIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("process_tasks")
      .delete()
      .in("id", hubOnlyIds);

    if (deleteError) {
      failed += hubOnlyIds.length;
    } else {
      deleted += hubOnlyIds.length;
    }
  }

  return NextResponse.json({
    success: true,
    deleted,
    failed,
    ...(asanaErrors.length > 0 ? { asanaErrors } : {}),
  });
}
