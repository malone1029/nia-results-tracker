import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";
import { ADLI_TASK_NAMES, ADLI_TO_PDCA_SECTION } from "@/lib/asana-helpers";

export const maxDuration = 60;

// PDCA section names — the team's operational framework in Asana
const PDCA_SECTIONS = ["Plan", "Execute", "Evaluate", "Improve"];

// Flexible matching for the "Improve" section (handles various naming conventions)
const IMPROVE_SECTION_NAMES = ["improve", "act", "improvement", "improvements", "act (improve)"];

// Charter fields in the order they should appear in Asana project notes
const CHARTER_FIELD_ORDER = ["purpose", "stakeholders", "scope_includes", "scope_excludes", "mission_alignment"];

/**
 * Build readable text from a JSONB field (charter, ADLI, etc.)
 * Charter fields use explicit ordering; other fields use natural object order.
 */
function fieldToText(data: Record<string, unknown> | null, orderedKeys?: string[]): string {
  if (!data) return "";
  if (data.content && typeof data.content === "string") {
    return data.content;
  }

  const keys = orderedKeys
    ? [...orderedKeys, ...Object.keys(data).filter((k) => k !== "content" && !orderedKeys.includes(k))]
    : Object.keys(data).filter((k) => k !== "content");

  const parts: string[] = [];
  for (const key of keys) {
    const value = data[key];
    const fieldLabel = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(value) && value.length > 0) {
      parts.push(`**${fieldLabel}:**\n${value.map((v) => `- ${v}`).join("\n")}`);
    } else if (typeof value === "string" && value.trim()) {
      parts.push(`**${fieldLabel}:** ${value}`);
    }
  }
  return parts.join("\n\n");
}

// Asana project descriptions silently truncate around 15K chars.
// We use 12K as a safe budget to leave room for the Hub link and footer.
const ASANA_NOTES_CHAR_LIMIT = 12000;

/**
 * If the charter text exceeds Asana's project description limit,
 * use AI to condense it while preserving all key information.
 * Short charters pass through untouched (no AI call, no delay).
 */
async function condenseCharterForAsana(
  charterText: string,
  processName: string
): Promise<{ text: string; wasCondensed: boolean }> {
  if (charterText.length <= ASANA_NOTES_CHAR_LIMIT) {
    return { text: charterText, wasCondensed: false };
  }

  console.log(`[Asana Export] Charter is ${charterText.length} chars (limit ${ASANA_NOTES_CHAR_LIMIT}), condensing with AI...`);

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Rewrite this process charter to fit within ${ASANA_NOTES_CHAR_LIMIT} characters for an Asana project description. Keep it in plain text (no markdown formatting — Asana project descriptions are plain text).

Rules:
- Preserve ALL section headings and key information (purpose, scope, stakeholders, measures, risks)
- Keep specific names, roles, dates, and numbers exactly as written
- Condense verbose prose into concise bullet points
- Remove redundant phrasing but never remove a distinct piece of information
- Convert any tables into compact lists
- Target ${Math.round(ASANA_NOTES_CHAR_LIMIT * 0.9)} characters to leave some buffer

Process: ${processName}

Charter to condense:
${charterText}`,
        },
      ],
    });

    const condensed =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (condensed && condensed.length <= ASANA_NOTES_CHAR_LIMIT) {
      console.log(`[Asana Export] Condensed from ${charterText.length} to ${condensed.length} chars`);
      return { text: condensed, wasCondensed: true };
    }

    // If AI output is still too long, hard-truncate as last resort
    if (condensed && condensed.length > ASANA_NOTES_CHAR_LIMIT) {
      console.log(`[Asana Export] AI output still ${condensed.length} chars, truncating`);
      const truncated = condensed.slice(0, ASANA_NOTES_CHAR_LIMIT - 100) + "\n\n[Condensed — see full charter in the Hub]";
      return { text: truncated, wasCondensed: true };
    }

    // AI returned empty — fall back to hard truncation
    const truncated = charterText.slice(0, ASANA_NOTES_CHAR_LIMIT - 100) + "\n\n[Truncated — see full charter in the Hub]";
    return { text: truncated, wasCondensed: true };
  } catch (err) {
    console.error(`[Asana Export] AI condense failed:`, (err as Error).message);
    // Non-blocking fallback — hard truncate
    const truncated = charterText.slice(0, ASANA_NOTES_CHAR_LIMIT - 100) + "\n\n[Truncated — see full charter in the Hub]";
    return { text: truncated, wasCondensed: true };
  }
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
  appUrl: string,
  workspaceGid?: string
) {
  const { data: improvements } = await supabase
    .from("process_improvements")
    .select("id, section_affected, title, description")
    .eq("process_id", processId)
    .is("trigger_detail", null);

  if (!improvements || improvements.length === 0) return 0;

  // Sections that should NOT become Asana tasks (Hub-only features)
  const SKIP_SECTIONS = ["workflow"];

  const sectionLabels: Record<string, string> = {
    approach: "Approach",
    deployment: "Deployment",
    learning: "Learning",
    integration: "Integration",
    charter: "Charter",
  };

  let created = 0;
  for (const imp of improvements) {
    // Skip Hub-only sections (e.g., workflow/process maps) — they don't belong in Asana
    if (SKIP_SECTIONS.includes(imp.section_affected)) continue;

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
            ...(workspaceGid ? { workspace: workspaceGid } : {}),
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
  appUrl: string,
  workspaceGid?: string
): Promise<{ gids: Record<string, string>; created: number; updated: number; errors: string[] }> {
  const currentGids = (proc.asana_adli_task_gids as Record<string, string>) || {};
  const newGids: Record<string, string> = { ...currentGids };
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  const dimensions = ["approach", "deployment", "learning", "integration"] as const;
  const fieldMap: Record<string, string> = {
    approach: "adli_approach",
    deployment: "adli_deployment",
    learning: "adli_learning",
    integration: "adli_integration",
  };

  console.log(`[ADLI Export] Starting syncAdliTasks for process ${proc.id}, project ${projectGid}`);
  console.log(`[ADLI Export] Sections map:`, Object.fromEntries(existingSections));
  console.log(`[ADLI Export] Existing ADLI GIDs:`, currentGids);

  for (const dimension of dimensions) {
    const fieldKey = fieldMap[dimension];
    const rawField = proc[fieldKey];
    const content = fieldToText(rawField as Record<string, unknown> | null);
    const taskName = ADLI_TASK_NAMES[dimension];
    const pdcaSection = ADLI_TO_PDCA_SECTION[dimension]; // e.g., "plan"
    const sectionGid = existingSections.get(pdcaSection);

    console.log(`[ADLI Export] ${dimension}: field=${fieldKey}, hasData=${!!rawField}, contentLen=${content.length}, pdcaSection=${pdcaSection}, sectionGid=${sectionGid || "MISSING"}`);

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
      } catch (err) {
        // Task was deleted in Asana — fall through to create a new one
        console.warn(`[ADLI Export] Existing ${dimension} task (${existingGid}) not found, creating new:`, (err as Error).message);
      }
    }

    // Create new ADLI task, then explicitly move to correct PDCA section
    if (sectionGid) {
      try {
        const result = await asanaFetch(token, "/tasks", {
          method: "POST",
          body: JSON.stringify({
            data: {
              name: taskName,
              notes,
              ...(workspaceGid ? { workspace: workspaceGid } : {}),
              memberships: [{ project: projectGid, section: sectionGid }],
            },
          }),
        });
        const newTaskGid = result.data.gid;
        newGids[dimension] = newTaskGid;

        // Belt-and-suspenders: explicitly move to section (memberships alone can be unreliable)
        await asanaFetch(token, `/sections/${sectionGid}/addTask`, {
          method: "POST",
          body: JSON.stringify({ data: { task: newTaskGid } }),
        });

        created++;
      } catch (err) {
        const msg = `Failed to create ${dimension} task: ${(err as Error).message}`;
        console.error(`[ADLI Export] ${msg}`);
        errors.push(msg);
      }
    } else {
      const msg = `No section GID found for ${pdcaSection} — skipping ${dimension}`;
      console.error(`[ADLI Export] ${msg}`);
      errors.push(msg);
    }
  }

  console.log(`[ADLI Export] Result: created=${created}, updated=${updated}, errors=${errors.length}, workspaceGid=${workspaceGid || "MISSING"}`);
  return { gids: newGids, created, updated, errors };
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
    const rawCharterText = fieldToText(charter, CHARTER_FIELD_ORDER) || proc.description || "";
    const hubLink = `${appUrl}/processes/${processId}`;

    // If the charter is too long for Asana, AI condenses it automatically.
    // Short charters pass through untouched (no AI call, no delay).
    const { text: charterForAsana, wasCondensed } = await condenseCharterForAsana(
      rawCharterText,
      proc.name as string
    );

    const descriptionWithLinks = wasCondensed
      ? `Full charter: ${hubLink}\n\n---\n\n${charterForAsana}\n\n---\nCondensed by AI to fit Asana — view full charter at link above\nManaged by NIA Excellence Hub`
      : `Full charter: ${hubLink}\n\n---\n\n${charterForAsana}\n\n---\nManaged by NIA Excellence Hub`;

    console.log(`[Asana Export] Charter: ${rawCharterText.length} chars raw → ${charterForAsana.length} chars for Asana (condensed: ${wasCondensed})`);

    let existingGid = forceNew ? null : proc.asana_project_gid;
    let workspaceGid: string | undefined;

    // If the process is linked to an Asana project, verify it still exists
    if (existingGid) {
      try {
        const projCheck = await asanaFetch(token, `/projects/${existingGid}?opt_fields=name,workspace`);
        workspaceGid = projCheck.data?.workspace?.gid;
        if (!workspaceGid) {
          return NextResponse.json({ error: "Could not determine Asana workspace for this project. Try unlinking and re-linking." }, { status: 400 });
        }
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

      // Update project notes with charter (non-blocking — some users may not
      // have project-level edit permission even if they can create tasks)
      let notesWarning = "";
      try {
        // Send plain text (lower overhead than HTML → fits more content)
        await asanaFetch(token, `/projects/${existingGid}`, {
          method: "PUT",
          body: JSON.stringify({
            data: { notes: descriptionWithLinks },
          }),
        });
        // Read back to detect if Asana truncated the content
        try {
          const readBack = await asanaFetch(token, `/projects/${existingGid}?opt_fields=notes`);
          const storedLength = readBack.data?.notes?.length || 0;
          const sentLength = descriptionWithLinks.length;
          console.log(`[Asana Export] Notes sent: ${sentLength} chars, stored: ${storedLength} chars`);
          if (storedLength < sentLength - 50) {
            notesWarning = `Asana truncated the charter (${storedLength.toLocaleString()} of ${sentLength.toLocaleString()} chars kept). The full charter is linked at the top of the project description.`;
          }
        } catch {
          // Non-blocking — read-back check is optional
        }
      } catch {
        notesWarning = "Could not update project notes (you may not have project edit access in Asana). Tasks were synced successfully.";
      }

      // Get existing sections
      const sectionsRes = await asanaFetch(
        token,
        `/projects/${existingGid}/sections?opt_fields=name`
      );
      const existingSections = new Map<string, string>();
      for (const s of sectionsRes.data) {
        existingSections.set(s.name.toLowerCase(), s.gid);
      }

      // Create PDCA sections that don't exist yet (non-blocking per section)
      for (const sectionName of PDCA_SECTIONS) {
        if (!existingSections.has(sectionName.toLowerCase())) {
          try {
            const newSection = await asanaFetch(token, `/projects/${existingGid}/sections`, {
              method: "POST",
              body: JSON.stringify({ data: { name: sectionName } }),
            });
            existingSections.set(sectionName.toLowerCase(), newSection.data.gid);
          } catch {
            // User may not have permission to create sections — continue with existing ones
          }
        }
      }

      // Sync ADLI documentation tasks (create or update)
      const adliResult = await syncAdliTasks(
        token, proc as Record<string, unknown>, existingGid, existingSections, appUrl, workspaceGid
      );

      // Save updated ADLI task GIDs back to process (don't change guided_step — user may be mid-cycle)
      await supabase
        .from("processes")
        .update({
          asana_adli_task_gids: adliResult.gids,
        })
        .eq("id", processId);

      // Find the Improve section for backfilling
      const improveSectionGid = findImproveSectionGid(existingSections);

      // Backfill improvements that don't have Asana tasks yet
      let backfillCount = 0;
      if (improveSectionGid) {
        backfillCount = await backfillImprovements(
          supabase, token, processId, existingGid, improveSectionGid, appUrl, workspaceGid
        );
      }

      // Log in history
      await supabase.from("process_history").insert({
        process_id: processId,
        change_description: `Synced to Asana by ${user.email} (${adliResult.created} ADLI tasks created, ${adliResult.updated} updated${backfillCount > 0 ? `, ${backfillCount} improvements` : ""})`,
      });

      const allWarnings = [notesWarning, ...adliResult.errors].filter(Boolean);
      if (wasCondensed) {
        allWarnings.push("Charter was condensed by AI to fit Asana's description limit. The full charter is linked at the top of the project description.");
      }
      return NextResponse.json({
        action: "updated",
        asanaUrl: `https://app.asana.com/0/${existingGid}`,
        adliCreated: adliResult.created,
        adliUpdated: adliResult.updated,
        backfillCount,
        charterCondensed: wasCondensed,
        ...(allWarnings.length > 0 ? { warning: allWarnings.join(" | ") } : {}),
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
        notes: descriptionWithLinks,
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
      console.log(`[Asana Export] Created project ${newProjectGid} for process ${processId}`);

      // Create PDCA sections
      const sectionGids = new Map<string, string>();
      for (const sectionName of PDCA_SECTIONS) {
        const section = await asanaFetch(token, `/projects/${newProjectGid}/sections`, {
          method: "POST",
          body: JSON.stringify({ data: { name: sectionName } }),
        });
        sectionGids.set(sectionName.toLowerCase(), section.data.gid);
        console.log(`[Asana Export] Created section "${sectionName}" → ${section.data.gid}`);
      }

      // Create 4 ADLI documentation tasks (instead of single "Process Documentation" task)
      console.log(`[Asana Export] About to call syncAdliTasks...`);
      const adliResult = await syncAdliTasks(
        token, proc as Record<string, unknown>, newProjectGid, sectionGids, appUrl, workspaceId
      );
      console.log(`[Asana Export] syncAdliTasks result: created=${adliResult.created}, updated=${adliResult.updated}, gids=`, adliResult.gids);

      // Link the process to the new Asana project — start at beginning of improvement cycle
      await supabase
        .from("processes")
        .update({
          asana_project_gid: newProjectGid,
          asana_project_url: asanaUrl,
          asana_adli_task_gids: adliResult.gids,
          guided_step: "start",
        })
        .eq("id", processId);

      // Backfill existing improvements into the Improve section
      const improveSectionGid = sectionGids.get("improve") || null;
      const backfillCount = improveSectionGid
        ? await backfillImprovements(supabase, token, processId, newProjectGid, improveSectionGid, appUrl, workspaceId)
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
        charterCondensed: wasCondensed,
        ...(wasCondensed ? { warning: "Charter was condensed by AI to fit Asana's description limit. The full charter is linked at the top of the project description." } : {}),
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
