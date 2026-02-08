import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only context
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = await getAsanaToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "Asana not connected" }, { status: 401 });
  }

  try {
    // Get user's workspace
    const { data: tokenRow } = await supabase
      .from("user_asana_tokens")
      .select("workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!tokenRow?.workspace_id) {
      return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    // Fetch projects from the workspace
    const result = await asanaFetch(
      token,
      `/projects?workspace=${tokenRow.workspace_id}&opt_fields=name,notes,modified_at,team.name&limit=100`
    );

    const projects = result.data.map(
      (p: { gid: string; name: string; notes: string; modified_at: string; team?: { name: string } }) => ({
        gid: p.gid,
        name: p.name,
        description: p.notes ? p.notes.slice(0, 150) : "",
        modified_at: p.modified_at,
        team: p.team?.name || null,
      })
    );

    return NextResponse.json({ projects });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
