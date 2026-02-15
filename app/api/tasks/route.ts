import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";
import {
  PDCA_SECTION_VALUES,
  ADLI_DIMENSION_VALUES,
  TASK_SOURCE_VALUES,
  TASK_STATUS_VALUES,
  TASK_ORIGIN_VALUES,
} from "@/lib/pdca";

// Map pdca_section values to capitalized section names for Asana
const SECTION_LABEL: Record<string, string> = {
  plan: "Plan",
  execute: "Execute",
  evaluate: "Evaluate",
  improve: "Improve",
};

// ── Per-user rate limiter (shared with PATCH /api/tasks/[id]) ──
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

// GET ?processId=5 → all tasks for a process, ordered by sort_order then created_at
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");

  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }

  let query = supabase
    .from("process_tasks")
    .select("*")
    .eq("process_id", Number(processId));

  // Optional filters
  const priority = searchParams.get("priority");
  if (priority && ["high", "medium", "low"].includes(priority)) {
    query = query.eq("priority", priority);
  }

  const status = searchParams.get("status");
  if (status && ["pending", "active", "completed", "exported"].includes(status)) {
    query = query.eq("status", status);
  }

  const assignee = searchParams.get("assignee");
  if (assignee) {
    query = query.eq("assignee_email", assignee);
  }

  const search = searchParams.get("search");
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST — create one or more tasks
// Body: single task object OR array of task objects
// Required fields: process_id, title, pdca_section
// Single objects return the full task; arrays return { ids, count, success }
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const isSingleInsert = !Array.isArray(body);

  // Normalize to array so we can handle single and batch inserts uniformly
  const tasks = isSingleInsert ? [body] : body;

  if (tasks.length === 0) {
    return NextResponse.json({ error: "At least one task is required" }, { status: 400 });
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const task of tasks) {
    if (!task.process_id || !task.title || !task.pdca_section) {
      return NextResponse.json(
        { error: "Each task requires process_id, title, and pdca_section" },
        { status: 400 }
      );
    }
    if (typeof task.title !== "string" || task.title.trim().length === 0) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    if (!PDCA_SECTION_VALUES.includes(task.pdca_section)) {
      return NextResponse.json(
        { error: `Invalid pdca_section: ${task.pdca_section}. Must be one of: ${PDCA_SECTION_VALUES.join(", ")}` },
        { status: 400 }
      );
    }
    if (task.adli_dimension && !ADLI_DIMENSION_VALUES.includes(task.adli_dimension)) {
      return NextResponse.json(
        { error: `Invalid adli_dimension: ${task.adli_dimension}. Must be one of: ${ADLI_DIMENSION_VALUES.join(", ")}` },
        { status: 400 }
      );
    }
    if (task.source && !TASK_SOURCE_VALUES.includes(task.source)) {
      return NextResponse.json(
        { error: `Invalid source: ${task.source}. Must be one of: ${TASK_SOURCE_VALUES.join(", ")}` },
        { status: 400 }
      );
    }

    // Derive origin and source
    const source = task.source || "ai_suggestion";
    const origin = task.origin || (source === "user_created" ? "hub_manual" : "hub_ai");

    // Manual tasks skip "pending" review — they're immediately active
    const status = origin === "hub_manual" ? "active" : (task.status || "pending");

    rows.push({
      process_id: task.process_id,
      title: task.title.trim(),
      description: task.description || null,
      pdca_section: task.pdca_section,
      adli_dimension: task.adli_dimension || null,
      source,
      source_detail: task.source_detail || null,
      origin,
      status,
      // New fields for manual creation
      assignee_name: task.assignee_name || null,
      assignee_email: task.assignee_email || null,
      assignee_asana_gid: task.assignee_asana_gid || null,
      start_date: task.start_date || null,
      due_date: task.due_date || null,
      priority: task.priority || "medium",
    });
  }

  // Calculate sort_order for new tasks: find max for each (process_id, pdca_section) group
  for (const row of rows) {
    const { data: maxRow } = await supabase
      .from("process_tasks")
      .select("sort_order")
      .eq("process_id", row.process_id)
      .eq("pdca_section", row.pdca_section)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    row.sort_order = (maxRow?.sort_order ?? 0) + 1000;
  }

  // Insert — return full objects for single inserts, just ids for batch
  const { data, error } = await supabase
    .from("process_tasks")
    .insert(rows)
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log 'created' activity for each new task (best-effort)
  try {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();
    const userName = roleRow?.full_name || user.email || "Unknown";

    await supabase.from("task_activity_log").insert(
      data.map((t: { id: number }) => ({
        task_id: t.id,
        user_id: user.id,
        user_name: userName,
        action: "created",
      }))
    );
  } catch {
    // Activity logging is non-critical
  }

  // Single insert: attempt Asana sync if process is linked
  if (isSingleInsert && data.length === 1) {
    const createdTask = data[0];
    let asanaSyncFailed = false;

    // Check if the process is linked to Asana
    if (createdTask.origin === "hub_manual") {
      const { data: proc } = await supabase
        .from("processes")
        .select("asana_project_gid")
        .eq("id", createdTask.process_id)
        .single();

      if (proc?.asana_project_gid) {
        const token = await getAsanaToken(user.id);
        if (token) {
          try {
            // Get project sections
            const sectionsRes = await asanaFetch(
              token,
              `/projects/${proc.asana_project_gid}/sections?opt_fields=name`
            );
            const sectionMap = new Map<string, string>();
            for (const s of sectionsRes.data) {
              sectionMap.set(s.name.toLowerCase(), s.gid);
            }

            // Find or create the target PDCA section
            const targetLabel = SECTION_LABEL[createdTask.pdca_section] || createdTask.pdca_section;
            let sectionGid = sectionMap.get(targetLabel.toLowerCase());
            if (!sectionGid) {
              const newSection = await asanaFetch(
                token,
                `/projects/${proc.asana_project_gid}/sections`,
                {
                  method: "POST",
                  body: JSON.stringify({ data: { name: targetLabel } }),
                }
              );
              sectionGid = newSection.data.gid;
            }

            // Get workspace GID from project
            const projRes = await asanaFetch(
              token,
              `/projects/${proc.asana_project_gid}?opt_fields=workspace`
            );
            const workspaceGid = projRes.data.workspace?.gid;

            // Build Asana task data
            const asanaData: Record<string, unknown> = {
              name: createdTask.title,
              notes: createdTask.description || "",
              workspace: workspaceGid,
              memberships: [{ project: proc.asana_project_gid, section: sectionGid }],
            };
            if (createdTask.assignee_asana_gid) {
              asanaData.assignee = createdTask.assignee_asana_gid;
            }
            if (createdTask.start_date) {
              asanaData.start_on = createdTask.start_date;
            }
            if (createdTask.due_date) {
              asanaData.due_on = createdTask.due_date;
            }

            // Create the Asana task
            const result = await asanaFetch(token, "/tasks", {
              method: "POST",
              body: JSON.stringify({ data: asanaData }),
            });

            // Move to correct section (memberships can be unreliable)
            if (result.data?.gid && sectionGid) {
              await asanaFetch(token, `/sections/${sectionGid}/addTask`, {
                method: "POST",
                body: JSON.stringify({ data: { task: result.data.gid } }),
              }).catch(() => {}); // Non-blocking
            }

            // Update Supabase with Asana GID and URL
            const asanaTaskGid = result.data?.gid || null;
            const asanaTaskUrl = result.data?.permalink_url || null;
            if (asanaTaskGid) {
              await supabase
                .from("process_tasks")
                .update({
                  asana_task_gid: asanaTaskGid,
                  asana_task_url: asanaTaskUrl,
                  asana_section_name: targetLabel,
                  asana_section_gid: sectionGid,
                  last_synced_at: new Date().toISOString(),
                })
                .eq("id", createdTask.id);

              createdTask.asana_task_gid = asanaTaskGid;
              createdTask.asana_task_url = asanaTaskUrl;
              createdTask.asana_section_name = targetLabel;
              createdTask.asana_section_gid = sectionGid;
              createdTask.last_synced_at = new Date().toISOString();
            }
          } catch (err) {
            console.warn("[Task Create] Asana sync failed:", (err as Error).message);
            asanaSyncFailed = true;
          }
        }
      }
    }

    return NextResponse.json({
      ...createdTask,
      success: true,
      ...(asanaSyncFailed ? { asana_sync_failed: true } : {}),
    });
  }

  // Batch insert: return ids + count (backward-compatible)
  return NextResponse.json({
    ids: data.map((r: { id: number }) => r.id),
    count: data.length,
    success: true,
  });
}

// PATCH — update a task (title, description, pdca_section, status, asana fields)
// NOTE: This is the legacy PATCH used for Keep/Dismiss. For edits with
// Asana write-back, use PATCH /api/tasks/[id] instead.
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.pdca_section !== undefined) {
    if (!PDCA_SECTION_VALUES.includes(body.pdca_section)) {
      return NextResponse.json(
        { error: `Invalid pdca_section: ${body.pdca_section}. Must be one of: ${PDCA_SECTION_VALUES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.pdca_section = body.pdca_section;
  }
  if (body.status !== undefined) {
    if (!TASK_STATUS_VALUES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status: ${body.status}. Must be one of: ${TASK_STATUS_VALUES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = body.status;
  }
  if (body.origin !== undefined) {
    if (!TASK_ORIGIN_VALUES.includes(body.origin)) {
      return NextResponse.json(
        { error: `Invalid origin: ${body.origin}. Must be one of: ${TASK_ORIGIN_VALUES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.origin = body.origin;
  }
  if (body.asana_task_gid !== undefined) updates.asana_task_gid = body.asana_task_gid;
  if (body.asana_task_url !== undefined) updates.asana_task_url = body.asana_task_url;
  if (body.assignee_name !== undefined) updates.assignee_name = body.assignee_name;
  if (body.assignee_email !== undefined) updates.assignee_email = body.assignee_email;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.completed !== undefined) updates.completed = body.completed;
  if (body.completed_at !== undefined) updates.completed_at = body.completed_at;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("process_tasks")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
