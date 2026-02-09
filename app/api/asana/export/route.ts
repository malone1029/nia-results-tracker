import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";
import { ADLI_TASK_NAMES, ADLI_TO_PDCA_SECTION } from "@/lib/asana-helpers";

// PDCA section names — the team's operational framework in Asana
const PDCA_SECTIONS = ["Plan", "Execute", "Evaluate", "Improve"];

// Flexible matching for the "Improve" section (handles various naming conventions)
const IMPROVE_SECTION_NAMES = ["improve", "act", "improvement", "improvements", "act (improve)"];

/**
 * Build readable text from a JSONB field (charter, ADLI, etc.)
 */
function fieldToText(data: Record<string, unknown> | null): string {
  if (!data) return "";
  if (data.content && typeof data.content === "string") {
    return data.content;
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
  return parts.join("\n\n");
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

/**
 * Create or update the 4 ADLI documentation tasks in the Asana project.
 * Each task corresponds to one ADLI dimension and is placed in the matching PDCA section.
 */
async function syncAdliTasks(
  token: string,
  proc: Record<string, unknown>,
  projectGid: string,
  existingSections: Map<string, string>,
  appUrl: string
): Promise<{ gids: Record<string, string>; created: number; updated: number }> {
  const currentGids = (proc.asana_adli_task_gids as Record<string, string>) || {};
  const newGids: Record<string, string> = { ...currentGids };
  let created = 0;
  let updated = 0;

  const dimensions = ["approach", "deployment", "learning", "integration"] as const;
  const fieldMap: Record<string, string> = {
    approach: "adli_approach",
    deployment: "adli_deployment",
    learning: "adli_learning",
    integration: "adli_integration",
  };

  for (const dimension of dimensions) {
    const fieldKey = fieldMap[dimension];
    const content = fieldToText(proc[fieldKey] as Record<string, unknown> | null);
    const taskName = ADLI_TASK_NAMES[dimension];
    const pdcaSection = ADLI_TO_PDCA_SECTION[dimension]; // e.g., "plan"
    const sectionGid = existingSections.get(pdcaSection);

    // Build notes with Hub footer
    const notes = content
      ? `${content}\n\n---\nManaged by NIA Excellence Hub\n${appUrl}/processes/${proc.id}`
      : `No documentation yet.\n\n---\nManaged by NIA Excellence Hub\n${appUrl}/processes/${proc.id}`;

    const existingGid = currentGids[dimension];

    if (existingGid) {
      // Try to update existing task (and move to correct section if needed)
      try {
        await asanaFetch(token, `/tasks/${existingGid}`, {
          method: "PUT",
          body: JSON.stringify({
            data: {
              name: taskName,
              notes,
            },
          }),
        });
        // Move task to the correct PDCA section (in case it was placed wrong before)
        if (sectionGid) {
          await asanaFetch(token, `/sections/${sectionGid}/addTask`, {
            method: "POST",
            body: JSON.stringify({ data: { task: existingGid } }),
          });
        }
        updated++;
        continue;
      } catch {
        // Task was deleted — fall through to create
      }
    }

    // Create new ADLI task — use memberships only (not projects) so it goes to the right section
    if (sectionGid) {
      try {
        const result = await asanaFetch(token, "/tasks", {
          method: "POST",
          body: JSON.stringify({
            data: {
              name: taskName,
              notes,
              memberships: [{ project: projectGid, section: sectionGid }],
            },
          }),
        });
        newGids[dimension] = result.data.gid;
        created++;
      } catch {
        // Non-blocking — continue with other dimensions
      }
    }
  }

  return { gids: newGids, created, updated };
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
            .update({ asana_project_gid: null, asana_project_url: null, asana_adli_task_gids: {} })
            .eq("id", processId);
          existingGid = null;
        } else {
          throw err;
        }
      }
    }

    if (existingGid) {
      // ═══ UPDATE EXISTING ASANA PROJECT ═══

      // Update project notes with charter
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

      // Sync ADLI documentation tasks (create or update)
      const adliResult = await syncAdliTasks(
        token, proc as Record<string, unknown>, existingGid, existingSections, appUrl
      );

      // Save updated ADLI task GIDs back to process
      await supabase
        .from("processes")
        .update({
          asana_adli_task_gids: adliResult.gids,
          guided_step: "export",
        })
        .eq("id", processId);

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
        change_description: `Synced to Asana by ${user.email} (${adliResult.created} ADLI tasks created, ${adliResult.updated} updated${backfillCount > 0 ? `, ${backfillCount} improvements` : ""})`,
      });

      return NextResponse.json({
        action: "updated",
        asanaUrl: `https://app.asana.com/0/${existingGid}`,
        adliCreated: adliResult.created,
        adliUpdated: adliResult.updated,
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
      const sectionGids = new Map<string, string>();
      for (const sectionName of PDCA_SECTIONS) {
        const section = await asanaFetch(token, `/projects/${newProjectGid}/sections`, {
          method: "POST",
          body: JSON.stringify({ data: { name: sectionName } }),
        });
        sectionGids.set(sectionName.toLowerCase(), section.data.gid);
      }

      // Create 4 ADLI documentation tasks (instead of single "Process Documentation" task)
      const adliResult = await syncAdliTasks(
        token, proc as Record<string, unknown>, newProjectGid, sectionGids, appUrl
      );

      // Link the process to the new Asana project
      await supabase
        .from("processes")
        .update({
          asana_project_gid: newProjectGid,
          asana_project_url: asanaUrl,
          asana_adli_task_gids: adliResult.gids,
          guided_step: "export",
        })
        .eq("id", processId);

      // Backfill existing improvements into the Improve section
      const improveSectionGid = sectionGids.get("improve") || null;
      const backfillCount = improveSectionGid
        ? await backfillImprovements(supabase, token, processId, newProjectGid, improveSectionGid, appUrl)
        : 0;

      // Log in history
      await supabase.from("process_history").insert({
        process_id: processId,
        change_description: `Exported to new Asana project by ${user.email} (${adliResult.created} ADLI tasks${backfillCount > 0 ? `, ${backfillCount} improvements` : ""})`,
      });

      return NextResponse.json({
        action: "created",
        asanaUrl,
        projectGid: newProjectGid,
        adliCreated: adliResult.created,
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
