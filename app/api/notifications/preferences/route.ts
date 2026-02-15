import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

const DEFAULT_PREFERENCES = {
  notify_on_assignment: true,
  notify_on_due_approaching: true,
  notify_on_completion: true,
  notify_on_mention: true,
  notify_weekly_digest: true,
};

/** GET /api/notifications/preferences — return user's preferences (or defaults) */
export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("notification_preferences")
    .select("notify_on_assignment, notify_on_due_approaching, notify_on_completion, notify_on_mention, notify_weekly_digest")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(data || DEFAULT_PREFERENCES);
}

/** PATCH /api/notifications/preferences — upsert preferences */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  // Only allow known boolean fields
  const updates: Record<string, boolean> = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    if (typeof body[key] === "boolean") {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Upsert: insert if no row exists, update if it does
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
