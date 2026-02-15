import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

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
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const body = await request.json();
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit: 30 updates/min per user
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  // Fetch the task to check origin and get asana_task_gid
  const { data: task, error: fetchError } = await supabase
    .from("process_tasks")
    .select("id, origin, asana_task_gid")
    .eq("id", id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Build Supabase update object from allowed fields
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) updates.description = body.description;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.assignee_name !== undefined) updates.assignee_name = body.assignee_name;
  if (body.assignee_email !== undefined) updates.assignee_email = body.assignee_email;
  if (body.assignee_asana_gid !== undefined)
    updates.assignee_asana_gid = body.assignee_asana_gid;

  // Auto-derive status and completed_at from completed boolean
  if (body.completed !== undefined) {
    updates.completed = body.completed;
    if (body.completed) {
      updates.completed_at = new Date().toISOString();
      updates.status = "completed";
    } else {
      updates.completed_at = null;
      updates.status = "active";
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // For Asana-origin tasks: push to Asana first
  if (task.origin === "asana" && task.asana_task_gid) {
    const token = await getAsanaToken(user.id);
    if (!token) {
      return NextResponse.json(
        {
          error: "asana_not_connected",
          message: "Asana not connected. Reconnect in Settings.",
        },
        { status: 401 }
      );
    }

    // Map Hub field names to Asana API field names
    const asanaData: Record<string, unknown> = {};
    if (body.title !== undefined) asanaData.name = body.title;
    if (body.description !== undefined) asanaData.notes = body.description;
    if (body.due_date !== undefined) asanaData.due_on = body.due_date;
    if (body.completed !== undefined) asanaData.completed = body.completed;
    if (body.assignee_asana_gid !== undefined)
      asanaData.assignee = body.assignee_asana_gid;

    if (Object.keys(asanaData).length > 0) {
      try {
        await asanaFetch(token, `/tasks/${task.asana_task_gid}`, {
          method: "PUT",
          body: JSON.stringify({ data: asanaData }),
        });
      } catch (err) {
        return NextResponse.json(
          {
            error: "asana_sync_failed",
            message:
              (err as Error).message ||
              "Couldn't update in Asana. Please try again.",
          },
          { status: 502 }
        );
      }
    }

    // Mark when we last synced
    updates.last_synced_at = new Date().toISOString();
  }

  // Update Supabase
  const { error: updateError } = await supabase
    .from("process_tasks")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
