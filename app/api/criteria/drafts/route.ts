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
 * GET /api/criteria/drafts
 *
 * ?tier=excellence_builder (default) — returns all drafts for this tier.
 * ?item_id=X — returns the draft for a specific item + tier.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const tier = searchParams.get("tier") || "excellence_builder";
  const itemId = searchParams.get("item_id");

  if (itemId) {
    const { data, error } = await supabase
      .from("baldrige_drafts")
      .select("*")
      .eq("item_id", Number(itemId))
      .eq("tier", tier)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || null);
  }

  // All drafts for this tier
  const { data, error } = await supabase
    .from("baldrige_drafts")
    .select("*")
    .eq("tier", tier)
    .order("item_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/**
 * POST /api/criteria/drafts
 * Upsert a draft for an item + tier. Admin only.
 * Body: { item_id, narrative_text, tier?, status?, figures? }
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    item_id,
    narrative_text,
    tier = "excellence_builder",
    status,
    figures,
    last_ai_generated_at,
  } = body;

  if (!item_id || narrative_text === undefined) {
    return NextResponse.json(
      { error: "item_id and narrative_text are required" },
      { status: 400 }
    );
  }

  const wordCount = narrative_text.trim().split(/\s+/).filter(Boolean).length;

  // Build the upsert payload
  const payload: Record<string, unknown> = {
    item_id,
    tier,
    narrative_text,
    word_count: wordCount,
    last_edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status) payload.status = status;
  if (figures !== undefined) payload.figures = figures;
  if (last_ai_generated_at) payload.last_ai_generated_at = last_ai_generated_at;

  const { data, error } = await supabase
    .from("baldrige_drafts")
    .upsert(payload, { onConflict: "item_id,tier" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
