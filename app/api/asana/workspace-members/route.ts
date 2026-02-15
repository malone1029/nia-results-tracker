import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

// Module-level cache: workspace_id → { members, expiresAt }
const cache = new Map<
  string,
  { members: { gid: string; name: string; email: string }[]; expiresAt: number }
>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * GET /api/asana/workspace-members
 *
 * Returns all users in the current user's Asana workspace.
 * Cached in-memory for 10 minutes (serverless-friendly for ~20 members).
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get workspace ID
  const { data: tokenRow } = await supabase
    .from("user_asana_tokens")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow?.workspace_id) {
    return NextResponse.json(
      { error: "not_connected", message: "Asana not connected. Go to Settings to connect." },
      { status: 401 }
    );
  }

  const workspaceId = tokenRow.workspace_id;

  // Check cache
  const cached = cache.get(workspaceId);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ members: cached.members });
  }

  // Fetch from Asana
  const token = await getAsanaToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: "not_connected", message: "Asana token expired. Reconnect in Settings." },
      { status: 401 }
    );
  }

  try {
    const data = await asanaFetch(
      token,
      `/workspaces/${workspaceId}/users?opt_fields=name,email&limit=100`
    );

    const members = (data.data || []).map(
      (u: { gid: string; name: string; email: string }) => ({
        gid: u.gid,
        name: u.name,
        email: u.email,
      })
    );

    // Sort by name
    members.sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name)
    );

    // Cache
    cache.set(workspaceId, { members, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json({ members });
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", message: (err as Error).message || "Failed to fetch workspace members" },
      { status: 502 }
    );
  }
}
