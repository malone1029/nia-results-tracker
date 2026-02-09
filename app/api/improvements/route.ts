import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");

  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("process_improvements")
    .select("*")
    .eq("process_id", Number(processId))
    .order("committed_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const {
    process_id,
    section_affected,
    change_type = "modification",
    title,
    description,
    trigger,
    trigger_detail,
    before_snapshot,
    after_snapshot,
    source = "user_initiated",
    committed_by,
  } = body;

  if (!process_id || !section_affected || !title) {
    return NextResponse.json(
      { error: "process_id, section_affected, and title are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("process_improvements")
    .insert({
      process_id,
      section_affected,
      change_type,
      title,
      description,
      trigger,
      trigger_detail,
      before_snapshot,
      after_snapshot,
      source,
      committed_by,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { id, status, impact_notes, impact_assessed } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "implemented") {
      updates.implemented_date = new Date().toISOString();
    }
  }
  if (impact_notes !== undefined) updates.impact_notes = impact_notes;
  if (impact_assessed !== undefined) {
    updates.impact_assessed = impact_assessed;
    if (impact_assessed) {
      updates.impact_assessment_date = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("process_improvements")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("process_improvements")
    .delete()
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
