/**
 * Shared Asana task sync logic.
 * Used by both single-process sync and admin bulk sync endpoints.
 */

import { asanaFetch } from "./asana";
import {
  fetchProjectSections,
  ADLI_TASK_PATTERNS,
  type TaskData,
  type SubtaskData,
} from "./asana-helpers";
import type { PdcaSection } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncResult {
  processId: number;
  processName: string;
  imported: number;
  updated: number;
  removed: number;
  total: number;
  lastSyncedAt: string;
  error?: string;
}

/**
 * Check if a task name matches an ADLI documentation task (should be skipped).
 */
function isAdliTask(taskName: string): boolean {
  const lower = taskName.toLowerCase().trim();
  return Object.keys(ADLI_TASK_PATTERNS).some((pattern) =>
    lower.startsWith(pattern)
  );
}

/**
 * Map an Asana section name to a PDCA section (case-insensitive).
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
 * Sync all tasks from a linked Asana project into the process_tasks table.
 * - Upserts by asana_task_gid (update existing, insert new)
 * - Skips ADLI documentation tasks
 * - Deletes Hub rows for Asana tasks no longer in Asana
 * - Fetches assignee emails for Hub user matching
 */
export async function syncProcessTasks(
  supabase: SupabaseClient,
  token: string,
  processId: number,
  processName: string,
  asanaProjectGid: string
): Promise<SyncResult> {
  // Fetch all sections → tasks → subtasks from Asana
  const sectionData = await fetchProjectSections(token, asanaProjectGid);

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

  const assigneeGids: string[] = [];

  for (const section of sectionData) {
    for (const task of section.tasks) {
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

  // Get all tasks with an asana_task_gid for this process (any origin).
  // Hub-created tasks that were exported to Asana also have a GID — we
  // must match those too, otherwise sync creates duplicates.
  const { data: existingTasks } = await supabase
    .from("process_tasks")
    .select("id, asana_task_gid")
    .eq("process_id", processId)
    .not("asana_task_gid", "is", null);

  const existingByGid = new Map<string, number>();
  for (const t of existingTasks || []) {
    if (t.asana_task_gid) {
      existingByGid.set(t.asana_task_gid, t.id);
    }
  }

  const seenGids = new Set<string>();
  let imported = 0;
  let updated = 0;
  const now = new Date().toISOString();

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
      source: "ai_suggestion" as const,
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
          origin: "asana",
        })
        .eq("id", existingId);

      updated++;
    } else {
      await supabase.from("process_tasks").insert(row);
      imported++;
    }
  }

  // Delete Asana-origin tasks no longer in Asana
  let removed = 0;
  for (const [gid, id] of existingByGid) {
    if (!seenGids.has(gid)) {
      await supabase.from("process_tasks").delete().eq("id", id);
      removed++;
    }
  }

  return {
    processId,
    processName,
    imported,
    updated,
    removed,
    total: asanaTasks.length,
    lastSyncedAt: now,
  };
}
