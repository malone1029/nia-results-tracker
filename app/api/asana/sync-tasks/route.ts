import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";
import {
  fetchProjectSections,
  ADLI_TASK_PATTERNS,
  type TaskData,
  type SubtaskData,
} from "@/lib/asana-helpers";
import type { PdcaSection } from "@/lib/types";

export const maxDuration = 60;

/**
 * Check if a task name matches an ADLI documentation task (should be skipped during sync).
 * ADLI tasks are managed separately by the existing ADLI import/export system.
 */
function isAdliTask(taskName: string): boolean {
  const lower = taskName.toLowerCase().trim();
  return Object.keys(ADLI_TASK_PATTERNS).some((pattern) =>
    lower.startsWith(pattern)
  );
}

/**
 * Map an Asana section name to a PDCA section (case-insensitive).
 * Returns 'plan' as the default if no match.
 */
function sectionToPdca(sectionName: string): PdcaSection {
  const lower = sectionName.toLowerCase().trim();
  const map: Record<string, PdcaSection> = {
    plan: "plan",
    execute: "execute",
    evaluate: "evaluate",
    improve: "improve",
  };
  return map[lower] || "plan";
}

/**
 * Batch-fetch assignee emails from the Asana user API.
 * Caches results by GID to avoid redundant calls within a sync.
 */
async function fetchAssigneeEmails(
  token: string,
  assigneeGids: string[]
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  const uniqueGids = [...new Set(assigneeGids)];

  for (const gid of uniqueGids) {
    try {
      const res = await asanaFetch(
        token,
        `/users/${gid}?opt_fields=email`
      );
      if (res.data?.email) {
        emailMap.set(gid, res.data.email);
      }
    } catch {
      // Non-blocking: some users may not expose email
    }
  }

  return emailMap;
}

/**
 * POST /api/asana/sync-tasks
 * Imports ALL tasks from a linked Asana project into process_tasks.
 * - Upserts by asana_task_gid (update existing, insert new)
 * - Skips ADLI documentation tasks
 * - Deletes Hub rows for Asana tasks no longer in the API response
 * - Fetches assignee emails for Hub user matching
 *
 * Body: { processId: number }
 * Returns: { imported, updated, removed, total }
 */
export async function POST(request: Request) {
  const { processId } = await request.json();

  if (!processId) {
    return NextResponse.json(
      { error: "processId is required" },
      { status: 400 }
    );
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
    return NextResponse.json(
      {
        error: "not_connected",
        message: "Asana not connected. Go to Settings to connect.",
      },
      { status: 401 }
    );
  }

  // Fetch process to get the linked Asana project GID
  const { data: proc, error: procError } = await supabase
    .from("processes")
    .select("id, asana_project_gid")
    .eq("id", processId)
    .single();

  if (procError || !proc) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  if (!proc.asana_project_gid) {
    return NextResponse.json(
      {
        error: "not_linked",
        message: "This process is not linked to an Asana project.",
      },
      { status: 400 }
    );
  }

  try {
    // Fetch all sections → tasks → subtasks from Asana
    const sectionData = await fetchProjectSections(
      token,
      proc.asana_project_gid
    );

    // Collect all non-ADLI tasks with their section context
    const asanaTasks: {
      task: TaskData | SubtaskData;
      sectionName: string;
      sectionGid: string;
      pdcaSection: PdcaSection;
      parentGid: string | null;
      isSubtask: boolean;
      permalinkUrl: string | null;
    }[] = [];

    // Collect all assignee GIDs for batch email fetch
    const assigneeGids: string[] = [];

    for (const section of sectionData) {
      for (const task of section.tasks) {
        // Skip ADLI documentation tasks
        if (isAdliTask(task.name)) continue;

        asanaTasks.push({
          task,
          sectionName: section.name,
          sectionGid: section.gid,
          pdcaSection: sectionToPdca(section.name),
          parentGid: null,
          isSubtask: false,
          permalinkUrl: task.permalink_url,
        });

        if (task.assignee_gid) assigneeGids.push(task.assignee_gid);

        // Include subtasks (skip ADLI subtasks too)
        for (const sub of task.subtasks) {
          if (isAdliTask(sub.name)) continue;

          asanaTasks.push({
            task: sub,
            sectionName: section.name,
            sectionGid: section.gid,
            pdcaSection: sectionToPdca(section.name),
            parentGid: task.gid,
            isSubtask: true,
            permalinkUrl: null,
          });

          if (sub.assignee_gid) assigneeGids.push(sub.assignee_gid);
        }
      }
    }

    // Batch-fetch assignee emails
    const emailMap = await fetchAssigneeEmails(token, assigneeGids);

    // Get existing Asana-origin tasks for this process (for upsert/delete logic)
    const { data: existingTasks } = await supabase
      .from("process_tasks")
      .select("id, asana_task_gid")
      .eq("process_id", processId)
      .eq("origin", "asana");

    const existingByGid = new Map<string, number>();
    for (const t of existingTasks || []) {
      if (t.asana_task_gid) {
        existingByGid.set(t.asana_task_gid, t.id);
      }
    }

    // Track which GIDs we see from Asana (to detect removals)
    const seenGids = new Set<string>();
    let imported = 0;
    let updated = 0;
    const now = new Date().toISOString();

    // Upsert each task
    for (const item of asanaTasks) {
      const { task, sectionName, sectionGid, pdcaSection, parentGid, isSubtask, permalinkUrl } = item;
      const gid = task.gid;
      seenGids.add(gid);

      const assigneeEmail = task.assignee_gid
        ? emailMap.get(task.assignee_gid) || null
        : null;

      const row = {
        process_id: processId,
        title: task.name,
        description: task.notes || null,
        pdca_section: pdcaSection,
        origin: "asana" as const,
        source: "ai_suggestion" as const, // Default; not meaningful for Asana imports
        status: task.completed ? ("completed" as const) : ("active" as const),
        assignee_name: task.assignee || null,
        assignee_email: assigneeEmail,
        assignee_asana_gid: task.assignee_gid || null,
        due_date: task.due_on || null,
        completed: task.completed,
        completed_at: task.completed_at || null,
        asana_section_name: sectionName,
        asana_section_gid: sectionGid,
        parent_asana_gid: parentGid,
        is_subtask: isSubtask,
        asana_task_gid: gid,
        asana_task_url: permalinkUrl,
        last_synced_at: now,
      };

      if (existingByGid.has(gid)) {
        // Update existing row
        const existingId = existingByGid.get(gid)!;
        const { title, description, status, assignee_name, assignee_email: ae,
          assignee_asana_gid, due_date, completed, completed_at,
          asana_section_name, asana_section_gid, parent_asana_gid,
          is_subtask, asana_task_url, last_synced_at } = row;

        await supabase
          .from("process_tasks")
          .update({
            title, description, status, assignee_name,
            assignee_email: ae, assignee_asana_gid,
            due_date, completed, completed_at,
            asana_section_name, asana_section_gid,
            parent_asana_gid, is_subtask, asana_task_url,
            last_synced_at,
          })
          .eq("id", existingId);

        updated++;
      } else {
        // Insert new row
        await supabase.from("process_tasks").insert(row);
        imported++;
      }
    }

    // Delete Asana-origin tasks that no longer exist in Asana
    const removedGids: string[] = [];
    for (const [gid, id] of existingByGid) {
      if (!seenGids.has(gid)) {
        removedGids.push(gid);
        await supabase.from("process_tasks").delete().eq("id", id);
      }
    }

    return NextResponse.json({
      imported,
      updated,
      removed: removedGids.length,
      total: asanaTasks.length,
      lastSyncedAt: now,
    });
  } catch (err) {
    const errMsg = (err as Error).message || "";

    // Handle deleted/inaccessible Asana project
    if (
      errMsg.includes("Unknown object") ||
      errMsg.includes("Not Found") ||
      errMsg.includes("404")
    ) {
      return NextResponse.json(
        {
          error: "not_linked",
          message: "The linked Asana project no longer exists.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
