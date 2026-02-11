import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Helper: check if current user is admin and return their auth_id.
 */
async function getAdminUser(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (data?.role !== "admin") return null;
  return user;
}

/**
 * GET /api/admin/users
 * Returns all users from user_roles, ordered by last login. Admin only.
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const adminUser = await getAdminUser(supabase);

  if (!adminUser) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("id, auth_id, email, full_name, role, last_login_at, created_at")
    .order("last_login_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data, currentUserId: adminUser.id });
}

/**
 * PATCH /api/admin/users
 * Update a user's role. Admin only. Cannot change own role.
 */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const adminUser = await getAdminUser(supabase);

  if (!adminUser) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { authId, role } = body;

  if (!authId || !role) {
    return NextResponse.json(
      { error: "authId and role are required" },
      { status: 400 }
    );
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json(
      { error: "role must be 'admin' or 'member'" },
      { status: 400 }
    );
  }

  // Prevent self-demotion
  if (authId === adminUser.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("user_roles")
    .update({ role })
    .eq("auth_id", authId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
