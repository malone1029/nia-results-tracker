import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Helper: check if current user is admin.
 */
async function isAdmin(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  return data?.role === "admin";
}

/**
 * POST /api/criteria/mappings
 * Create a new process-to-question mapping. Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { process_id, question_id, coverage = "primary", notes, mapped_by = "manual" } = body;

  if (!process_id || !question_id) {
    return NextResponse.json(
      { error: "process_id and question_id are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("process_question_mappings")
    .insert({ process_id, question_id, coverage, notes, mapped_by })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This process is already mapped to this question" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}

/**
 * PATCH /api/criteria/mappings
 * Update coverage or notes on a mapping. Admin only.
 */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id, coverage, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (coverage) updates.coverage = coverage;
  if (notes !== undefined) updates.notes = notes;

  const { error } = await supabase
    .from("process_question_mappings")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/criteria/mappings
 * Remove a mapping. Admin only.
 */
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("process_question_mappings")
    .delete()
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
