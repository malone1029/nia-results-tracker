import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole, isSuperAdminRole } from "@/lib/auth-helpers";

export async function GET() {
  const supabase = await createSupabaseServer();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: "member", isAdmin: false, isSuperAdmin: false });
  }

  // Look up role from user_roles table
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const role = data?.role || "member";

  return NextResponse.json({
    role,
    isAdmin: isAdminRole(role),
    isSuperAdmin: isSuperAdminRole(role),
  });
}
