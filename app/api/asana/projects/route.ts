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

    // Fetch ALL projects from the workspace using pagination
    const allProjects: { gid: string; name: string; description: string; modified_at: string; team: string | null }[] = [];
    let nextPage: string | null = `/projects?workspace=${tokenRow.workspace_id}&opt_fields=name,notes,modified_at,team.name,archived&limit=100`;

    while (nextPage) {
      const result = await asanaFetch(token, nextPage);

      for (const p of result.data) {
        // Skip archived projects
        if (p.archived) continue;
        allProjects.push({
          gid: p.gid,
          name: p.name,
          description: p.notes ? p.notes.slice(0, 150) : "",
          modified_at: p.modified_at,
          team: p.team?.name || null,
        });
      }

      // Asana pagination: next_page has an offset or URI
      nextPage = result.next_page?.uri
        ? result.next_page.uri.replace("https://app.asana.com/api/1.0", "")
        : null;
    }

    // Sort by most recently modified first
    allProjects.sort((a, b) =>
      (b.modified_at || "").localeCompare(a.modified_at || "")
    );

    return NextResponse.json({ projects: allProjects, total: allProjects.length });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
