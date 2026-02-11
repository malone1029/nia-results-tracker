import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// DELETE — cancel/delete a scheduled wave
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; waveId: string }> }
) {
  const supabase = await createSupabaseServer();
  const { id, waveId } = await params;

  // Only allow deleting scheduled waves (not open/closed ones)
  const { data: wave } = await supabase
    .from("survey_waves")
    .select("status")
    .eq("id", Number(waveId))
    .eq("survey_id", Number(id))
    .single();

  if (!wave) {
    return NextResponse.json({ error: "Wave not found" }, { status: 404 });
  }

  if (wave.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled waves can be cancelled" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("survey_waves")
    .delete()
    .eq("id", Number(waveId))
    .eq("survey_id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
