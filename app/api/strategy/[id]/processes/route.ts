// app/api/strategy/[id]/processes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: objectiveId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { process_id } = await req.json();
  const { error } = await supabase
    .from("process_objectives")
    .insert({ process_id, objective_id: Number(objectiveId) });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: objectiveId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { process_id } = await req.json();
  const { error } = await supabase
    .from("process_objectives")
    .delete()
    .eq("process_id", process_id)
    .eq("objective_id", Number(objectiveId));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
