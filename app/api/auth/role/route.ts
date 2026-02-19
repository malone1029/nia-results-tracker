import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole, isSuperAdminRole } from "@/lib/auth-helpers";

interface ProxySession {
  adminId: string;
  targetAuthId: string;
  targetName: string;
  targetRole: string;
  startedAt: string;
}

export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      role: "member",
      isAdmin: false,
      isSuperAdmin: false,
      isProxying: false,
      proxyTargetName: null,
    });
  }

  // Check for an active proxy session belonging to this user
  const cookieStore = await cookies();
  const rawProxy = cookieStore.get("hub_proxy_session")?.value;
  if (rawProxy) {
    try {
      const session = JSON.parse(rawProxy) as ProxySession;
      if (session.adminId === user.id) {
        const role = session.targetRole as "member" | "admin" | "super_admin";
        return NextResponse.json({
          role,
          isAdmin: isAdminRole(role),
          isSuperAdmin: false, // Never elevate via proxy
          isProxying: true,
          proxyTargetName: session.targetName,
        });
      }
    } catch {
      // Malformed cookie — fall through to real role
    }
  }

  // Normal role lookup
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
    isProxying: false,
    proxyTargetName: null,
  });
}
