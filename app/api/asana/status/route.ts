import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false });

  const { data } = await supabase
    .from("user_asana_tokens")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ connected: !!data });
}
