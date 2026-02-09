import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

// PDCA section names — the team's operational framework in Asana
const PDCA_SECTIONS = ["Plan", "Execute", "Evaluate", "Improve"];

// Flexible matching for the "Improve" section (handles various naming conventions)
const IMPROVE_SECTION_NAMES = ["improve", "act", "improvement", "improvements", "act (improve)"];

/**
 * Build readable text from a JSONB field (charter, ADLI, etc.)
 */
function fieldToText(label: string, data: Record<string, unknown> | null): string {
  if (!data) return "";
  if (data.content && typeof data.content === "string") {
    return `## ${label}\n\n${data.content}`;
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "content") continue;
    const fieldLabel = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(value) && value.length > 0) {
      parts.push(`**${fieldLabel}:**\n${value.map((v) => `- ${v}`).join("\n")}`);
    } else if (typeof value === "string" && value.trim()) {
      parts.push(`**${fieldLabel}:** ${value}`);
    }
  }
  return parts.length > 0 ? `## ${label}\n\n${parts.join("\n\n")}` : "";
}

/**
 * Find the "Improve" section GID from an existing sections map (case-insensitive, flexible).
 */
function findImproveSectionGid(existingSections: Map<string, string>): string | null {
  for (const name of IMPROVE_SECTION_NAMES) {
    const gid = existingSections.get(name);
    if (gid) return gid;
  }
  return null;
}

/**
 * Build the combined process documentation text (charter + ADLI) for a single reference task.
 */
function buildDocumentationNotes(proc: Record<string, unknown>): string {
  const charter = proc.charter as Record<string, unknown> | null;
  const charterText = charter?.content && typeof charter.content === "string"
    ? `## Charter\n\n${charter.content}`
    : charter?.purpose && typeof charter.purpose === "string"
      ? `## Charter\n\n${charter.purpose}`
      : "";

  const adliParts = [
    fieldToText("Approach", proc.adli_approach as Record<string, unknown> | null),
    fieldToText("Deployment", proc.adli_deployment as Record<string, unknown> | null),
    fieldToText("Learning", proc.adli_learning as Record<string, unknown> | null),
    fieldToText("Integration", proc.adli_integration as Record<string, unknown> | null),
  ].filter(Boolean);

  const sections = [charterText, ...adliParts].filter(Boolean);
  return sections.join("\n\n---\n\n") || "No documentation yet. Edit this process in the Excellence Hub to add content.";
}

/**
 * Backfill existing improvements as Asana tasks in the Improve section.
 * Only creates tasks for improvements that don't already have a trigger_detail (Asana link).
 */
async function backfillImprovements(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  token: string,
  processId: number,
  projectGid: string,
  improveSectionGid: string,
  appUrl: string
) {
  const { data: improvements } = await supabase
    .from("process_improvements")
    .select("id, section_affected, title, description")
    .eq("process_id", processId)
    .is("trigger_detail", null);

  if (!improvements || improvements.length === 0) return 0;

  const sectionLabels: Record<string, string> = {
    approach: "Approach",
    deployment: "Deployment",
    learning: "Learning",
    integration: "Integration",
    charter: "Charter",
  };

  let created = 0;
  for (const imp of improvements) {
    try {
      const sectionLabel = sectionLabels[imp.section_affected] || imp.section_affected;
      const taskName = `[${sectionLabel}] ${imp.title}`;
      const taskNotes = [
        imp.description || `Improvement to ${sectionLabel} section.`,
        "",
        `View process: ${appUrl}/processes/${processId}`,
      ].join("\n");

      const result = await asanaFetch(token, "/tasks", {
        method: "POST",
        body: JSON.stringify({
          data: {
            name: taskName,
            notes: taskNotes,
            projects: [projectGid],
            memberships: [{ project: projectGid, section: improveSectionGid }],
          },
        }),
      });

      const taskUrl = result.data?.permalink_url || null;
      if (taskUrl) {
        await supabase
          .from("process_improvements")
          .update({ trigger_detail: taskUrl })
          .eq("id", imp.id);
      }
      created++;
    } catch {
      // Non-blocking — skip this improvement and continue
    }
  }
  return created;
}

export async function POST(request: Request) {
  const { processId, targetWorkspaceId, forceNew } = await request.json();

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nia-results-tracker.vercel.app";

  try {
    // Build project description from charter
    const charter = proc.charter as Record<string, unknown> | null;
    const charterContent = charter?.content && typeof charter.content === "string"
      ? charter.content
      : null;
    const charterPurpose = charter?.purpose && typeof charter.purpose === "string"
      ? charter.purpose
      : null;
    const projectDescription = charterContent || charterPurpose || proc.description || "";

    let existingGid = forceNew ? null : proc.asana_project_gid;

    // If the process is linked to an Asana project, verify it still exists
    if (existingGid) {
      try {
        await asanaFetch(token, `/projects/${existingGid}?opt_fields=name`);
      } catch (err) {
        // Project was deleted in Asana — clear the stale link and create a new one
        const errMsg = (err as Error).message || "";
        if (errMsg.includes("Unknown object") || errMsg.includes("Not Found") || errMsg.includes("404")) {
          await supabase
            .from("processes")
            .update({ asana_project_gid: null, asana_project_url: null })
            .eq("id", processId);
          existingGid = null;
        } else {
          throw err; // Re-throw unexpected errors
        }
      }
    }

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

      // Create PDCA sections that don't exist yet
      for (const sectionName of PDCA_SECTIONS) {
        if (!existingSections.has(sectionName.toLowerCase())) {
          const newSection = await asanaFetch(token, `/projects/${existingGid}/sections`, {
            method: "POST",
            body: JSON.stringify({ data: { name: sectionName } }),
          });
          existingSections.set(sectionName.toLowerCase(), newSection.data.gid);
        }
      }

      // Find the Improve section for backfilling
      const improveSectionGid = findImproveSectionGid(existingSections);

      // Backfill improvements that don't have Asana tasks yet
      let backfillCount = 0;
      if (improveSectionGid) {
        backfillCount = await backfillImprovements(
          supabase, token, processId, existingGid, improveSectionGid, appUrl
        );
      }

      // Log in history
      await supabase.from("process_history").insert({
        process_id: processId,
        change_description: `Synced to Asana project by ${user.email}${backfillCount > 0 ? ` (${backfillCount} improvement tasks created)` : ""}`,
      });

      return NextResponse.json({
        action: "updated",
        asanaUrl: `https://app.asana.com/0/${existingGid}`,
        backfillCount,
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

      // Fetch the user's teams — Asana organizations require a team when creating projects
      let teamId: string | null = null;
      try {
        const teamsRes = await asanaFetch(
          token,
          `/organizations/${workspaceId}/teams?limit=1`
        );
        teamId = teamsRes.data?.[0]?.gid || null;
      } catch {
        // Might be a basic workspace (not an organization) — team not required
      }

      // Create the project
      const projectData: Record<string, unknown> = {
        name: proc.name,
        notes: projectDescription,
        workspace: workspaceId,
      };
      if (teamId) {
        projectData.team = teamId;
      }

      const newProject = await asanaFetch(token, `/projects`, {
        method: "POST",
        body: JSON.stringify({ data: projectData }),
      });

      const newProjectGid = newProject.data.gid;
      const asanaUrl = `https://app.asana.com/0/${newProjectGid}`;

      // Create PDCA sections
      const sectionGids: Record<string, string> = {};
      for (const sectionName of PDCA_SECTIONS) {
        const section = await asanaFetch(token, `/projects/${newProjectGid}/sections`, {
          method: "POST",
          body: JSON.stringify({ data: { name: sectionName } }),
        });
        sectionGids[sectionName.toLowerCase()] = section.data.gid;
      }

      // Add a "Process Documentation" reference task in the Plan section
      const docNotes = buildDocumentationNotes(proc as Record<string, unknown>);
      await asanaFetch(token, "/tasks", {
        method: "POST",
        body: JSON.stringify({
          data: {
            name: "Process Documentation",
            notes: docNotes,
            projects: [newProjectGid],
            memberships: [{ project: newProjectGid, section: sectionGids["plan"] }],
          },
        }),
      });

      // Link the process to the new Asana project
      await supabase
        .from("processes")
        .update({
          asana_project_gid: newProjectGid,
          asana_project_url: asanaUrl,
        })
        .eq("id", processId);

      // Backfill existing improvements into the Improve section
      const backfillCount = await backfillImprovements(
        supabase, token, processId, newProjectGid, sectionGids["improve"], appUrl
      );

      // Log in history
      await supabase.from("process_history").insert({
        process_id: processId,
        change_description: `Exported to new Asana project by ${user.email}${backfillCount > 0 ? ` (${backfillCount} improvement tasks created)` : ""}`,
      });

      return NextResponse.json({
        action: "created",
        asanaUrl,
        projectGid: newProjectGid,
        backfillCount,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
