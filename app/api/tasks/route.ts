import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  PDCA_SECTION_VALUES,
  ADLI_DIMENSION_VALUES,
  TASK_SOURCE_VALUES,
  TASK_STATUS_VALUES,
} from "@/lib/pdca";

// GET ?processId=5 → all tasks for a process (pending + exported), ordered by created_at
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");

  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("process_tasks")
    .select("*")
    .eq("process_id", Number(processId))
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST — create one or more tasks
// Body: single task object OR array of task objects
// Required fields: process_id, title, pdca_section
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  // Normalize to array so we can handle single and batch inserts uniformly
  const tasks = Array.isArray(body) ? body : [body];

  if (tasks.length === 0) {
    return NextResponse.json({ error: "At least one task is required" }, { status: 400 });
  }

  const rows = [];
  for (const task of tasks) {
    if (!task.process_id || !task.title || !task.pdca_section) {
      return NextResponse.json(
        { error: "Each task requires process_id, title, and pdca_section" },
        { status: 400 }
      );
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

    rows.push({
      process_id: task.process_id,
      title: task.title,
      description: task.description || null,
      pdca_section: task.pdca_section,
      adli_dimension: task.adli_dimension || null,
      source: task.source || "ai_suggestion",
      source_detail: task.source_detail || null,
    });
  }

  const { data, error } = await supabase
    .from("process_tasks")
    .insert(rows)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ids: data.map((r: { id: number }) => r.id),
    count: data.length,
    success: true,
  });
}

// PATCH — update a task (title, description, pdca_section, status, asana fields)
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
  if (body.asana_task_gid !== undefined) updates.asana_task_gid = body.asana_task_gid;
  if (body.asana_task_url !== undefined) updates.asana_task_url = body.asana_task_url;

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

// DELETE ?id=42 — delete a single task
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("process_tasks")
    .delete()
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
