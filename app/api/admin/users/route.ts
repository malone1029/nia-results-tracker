import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole, isSuperAdminRole } from "@/lib/auth-helpers";

/**
 * Helper: get current user and their role. Returns null if not authenticated.
 */
async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  return { user, role: data?.role || "member" };
}

/**
 * GET /api/admin/users
 * Returns all users from user_roles, ordered by last login. Admin+ only.
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const auth = await getAuthenticatedUser(supabase);

  if (!auth || !isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("id, auth_id, email, full_name, role, last_login_at, created_at")
    .order("last_login_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data,
    currentUserId: auth.user.id,
    isSuperAdmin: isSuperAdminRole(auth.role),
  });
}

/**
 * PATCH /api/admin/users
 * Update a user's role. Super admin only. Cannot change own role or super_admin's role.
 */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const auth = await getAuthenticatedUser(supabase);

  if (!auth || !isSuperAdminRole(auth.role)) {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { authId, role } = body;

  if (!authId || !role) {
    return NextResponse.json(
      { error: "authId and role are required" },
      { status: 400 }
    );
  }

  if (!["super_admin", "admin", "member"].includes(role)) {
    return NextResponse.json(
      { error: "role must be 'member', 'admin', or 'super_admin'" },
      { status: 400 }
    );
  }

  // Prevent changing own role
  if (authId === auth.user.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  // Prevent changing another super_admin's role
  const { data: targetUser } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", authId)
    .single();

  if (targetUser?.role === "super_admin") {
    return NextResponse.json(
      { error: "Cannot modify another super admin's role" },
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
