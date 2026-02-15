import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// ── Per-user rate limiter ──
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

/** GET /api/tasks/[id]/comments — list comments for a task */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** POST /api/tasks/[id]/comments — add a comment */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const commentBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!commentBody || commentBody.length > 2000) {
    return NextResponse.json(
      { error: "Comment must be 1-2000 characters" },
      { status: 400 }
    );
  }

  // Get user display name
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  const userName = roleRow?.full_name || user.email || "Unknown";

  // Insert comment
  const { data: comment, error: insertError } = await supabase
    .from("task_comments")
    .insert({
      task_id: id,
      user_id: user.id,
      user_name: userName,
      body: commentBody,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Also log a 'commented' activity entry
  await supabase.from("task_activity_log").insert({
    task_id: id,
    user_id: user.id,
    user_name: userName,
    action: "commented",
  });

  return NextResponse.json(comment, { status: 201 });
}
