import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

/**
 * Build readable text from a JSONB field (charter, ADLI, etc.)
 * Falls back to the "content" field if present, otherwise builds from structured fields.
 */
function fieldToText(data: Record<string, unknown> | null): string {
  if (!data) return "";
  if (data.content && typeof data.content === "string") return data.content;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "content") continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(value) && value.length > 0) {
      parts.push(`**${label}:**\n${value.map((v) => `- ${v}`).join("\n")}`);
    } else if (typeof value === "string" && value.trim()) {
      parts.push(`**${label}:** ${value}`);
    }
  }
  return parts.join("\n\n");
}

export async function POST(request: Request) {
  const { processId, targetWorkspaceId } = await request.json();

  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = await getAsanaToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "Asana not connected. Go to Settings to connect." }, { status: 401 });
  }

  // Fetch the process
  const { data: proc, error: procError } = await supabase
    .from("processes")
    .select("*")
    .eq("id", processId)
    .single();

  if (procError || !proc) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  try {
    // Build the project description from charter
    // Use charter.content (what the user edits) first, then fall back to purpose, then description
    const charter = proc.charter as Record<string, unknown> | null;
    const charterContent = charter?.content && typeof charter.content === "string"
      ? charter.content
      : null;
    const charterPurpose = charter?.purpose && typeof charter.purpose === "string"
      ? charter.purpose
      : null;
    const projectDescription = charterContent || charterPurpose || proc.description || "";

    // Build ADLI section content
    const adliSections = [
      { name: "Approach", content: fieldToText(proc.adli_approach as Record<string, unknown>) },
      { name: "Deployment", content: fieldToText(proc.adli_deployment as Record<string, unknown>) },
      { name: "Learning", content: fieldToText(proc.adli_learning as Record<string, unknown>) },
      { name: "Integration", content: fieldToText(proc.adli_integration as Record<string, unknown>) },
    ].filter((s) => s.content.trim());

    const existingGid = proc.asana_project_gid;

    if (existingGid) {
      // ═══ UPDATE EXISTING ASANA PROJECT ═══

      // Update project description
      await asanaFetch(token, `/projects/${existingGid}`, {
        method: "PUT",
        body: JSON.stringify({
          data: { notes: projectDescription },
        }),
      });

      // Get existing sections
      const sectionsRes = await asanaFetch(
        token,
        `/projects/${existingGid}/sections?opt_fields=name`
      );
      const existingSections = new Map<string, string>();
      for (const s of sectionsRes.data) {
        existingSections.set(s.name.toLowerCase(), s.gid);
      }

      // Create or update ADLI sections
      for (const adli of adliSections) {
        const sectionGid = existingSections.get(adli.name.toLowerCase());
        if (!sectionGid) {
          // Create section
          const newSection = await asanaFetch(token, `/projects/${existingGid}/sections`, {
            method: "POST",
            body: JSON.stringify({
              data: { name: adli.name },
            }),
          });
          // Add a summary task with the content
          await asanaFetch(token, `/tasks`, {
            method: "POST",
            body: JSON.stringify({
              data: {
                name: `${adli.name} Summary`,
                notes: adli.content,
                projects: [existingGid],
                memberships: [{ project: existingGid, section: newSection.data.gid }],
              },
            }),
          });
        }
      }

      // Log in history
      await supabase.from("process_history").insert({
        process_id: processId,
        change_description: `Synced to Asana project by ${user.email}`,
      });

      return NextResponse.json({
        action: "updated",
        asanaUrl: `https://app.asana.com/0/${existingGid}`,
      });
    } else {
      // ═══ CREATE NEW ASANA PROJECT ═══

      // Need a workspace ID
      let workspaceId = targetWorkspaceId;
      if (!workspaceId) {
        const { data: tokenRow } = await supabase
          .from("user_asana_tokens")
          .select("workspace_id")
          .eq("user_id", user.id)
          .single();
        workspaceId = tokenRow?.workspace_id;
      }

      if (!workspaceId) {
        return NextResponse.json({ error: "No workspace found" }, { status: 400 });
      }

      // Create the project
      const newProject = await asanaFetch(token, `/projects`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            name: proc.name,
            notes: projectDescription,
            workspace: workspaceId,
          },
        }),
      });

      const newProjectGid = newProject.data.gid;
      const asanaUrl = `https://app.asana.com/0/${newProjectGid}`;

      // Create ADLI sections with summary tasks
      for (const adli of adliSections) {
        const section = await asanaFetch(token, `/projects/${newProjectGid}/sections`, {
          method: "POST",
          body: JSON.stringify({
            data: { name: adli.name },
          }),
        });

        await asanaFetch(token, `/tasks`, {
          method: "POST",
          body: JSON.stringify({
            data: {
              name: `${adli.name} Summary`,
              notes: adli.content,
              projects: [newProjectGid],
              memberships: [{ project: newProjectGid, section: section.data.gid }],
            },
          }),
        });
      }

      // Link the process to the new Asana project
      await supabase
        .from("processes")
        .update({
          asana_project_gid: newProjectGid,
          asana_project_url: asanaUrl,
        })
        .eq("id", processId);

      // Log in history
      await supabase.from("process_history").insert({
        process_id: processId,
        change_description: `Exported to new Asana project by ${user.email}`,
      });

      return NextResponse.json({
        action: "created",
        asanaUrl,
        projectGid: newProjectGid,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
