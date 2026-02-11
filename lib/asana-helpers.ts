/**
 * Shared Asana helpers used by import, resync, and export routes.
 * Centralizes ADLI task detection and data types to avoid duplication.
 */

import { asanaFetch } from "./asana";

// ── Types ────────────────────────────────────────────────────

export interface SubtaskData {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  assignee: string | null;
  due_on: string | null;
}

export interface TaskData {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  assignee: string | null;
  due_on: string | null;
  num_subtasks: number;
  permalink_url: string | null;
  subtasks: SubtaskData[];
}

export interface SectionData {
  name: string;
  gid: string;
  tasks: TaskData[];
}

// ── ADLI task detection ──────────────────────────────────────

/** Prefix patterns used to identify ADLI documentation tasks in Asana */
export const ADLI_TASK_PATTERNS: Record<string, string> = {
  "[adli: approach]": "approach",
  "[adli: deployment]": "deployment",
  "[adli: learning]": "learning",
  "[adli: integration]": "integration",
};


/** Canonical task names for export (what we create in Asana) */
export const ADLI_TASK_NAMES: Record<string, string> = {
  approach: "[ADLI: Approach] How We Do It",
  deployment: "[ADLI: Deployment] How We Roll It Out",
  learning: "[ADLI: Learning] How We Improve",
  integration: "[ADLI: Integration] How It Connects",
};

/** ADLI-to-PDCA section mapping for task placement in Asana */
export const ADLI_TO_PDCA_SECTION: Record<string, string> = {
  approach: "plan",
  deployment: "execute",
  learning: "evaluate",
  integration: "improve",
};

/**
 * Scan tasks across all sections for ADLI documentation tasks.
 * Returns a map of dimension → { gid, notes } for each found ADLI task.
 */
export function findAdliTasks(
  sections: SectionData[]
): Record<string, { gid: string; notes: string }> {
  const result: Record<string, { gid: string; notes: string }> = {};

  for (const section of sections) {
    for (const task of section.tasks) {
      const lower = task.name.toLowerCase().trim();
      for (const [pattern, dimension] of Object.entries(ADLI_TASK_PATTERNS)) {
        if (lower.startsWith(pattern) && !result[dimension]) {
          result[dimension] = { gid: task.gid, notes: task.notes };
        }
      }
    }
  }

  return result;
}

// ── Fetch helpers ────────────────────────────────────────────

/**
 * Fetch all sections and their tasks (with subtasks) for an Asana project.
 * Shared between import and resync to eliminate duplicated fetch logic.
 */
export async function fetchProjectSections(
  token: string,
  projectGid: string
): Promise<SectionData[]> {
  const sectionsRes = await asanaFetch(
    token,
    `/projects/${projectGid}/sections?opt_fields=name`
  );
  const sections = sectionsRes.data;

  const sectionData: SectionData[] = [];

  for (const section of sections) {
    const tasksRes = await asanaFetch(
      token,
      `/sections/${section.gid}/tasks?opt_fields=name,notes,completed,assignee.name,due_on,due_at,num_subtasks,permalink_url,custom_fields&limit=100`
    );

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const tasks: TaskData[] = [];
    for (const t of tasksRes.data as any[]) {
      let subtasks: SubtaskData[] = [];
      if (t.num_subtasks > 0) {
        try {
          const subRes = await asanaFetch(
            token,
            `/tasks/${t.gid}/subtasks?opt_fields=name,notes,completed,assignee.name,due_on`
          );
          subtasks = (subRes.data || []).map((s: any) => ({
            gid: s.gid,
            name: s.name,
            notes: s.notes || "",
            completed: s.completed,
            assignee: s.assignee?.name || null,
            due_on: s.due_on || null,
          }));
        } catch {
          // Non-blocking: continue without subtasks if fetch fails
        }
      }

      tasks.push({
        gid: t.gid,
        name: t.name,
        notes: t.notes || "",
        completed: t.completed,
        assignee: t.assignee?.name || null,
        due_on: t.due_on || t.due_at || null,
        num_subtasks: t.num_subtasks || 0,
        permalink_url: t.permalink_url || null,
        subtasks,
      });
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    sectionData.push({
      name: section.name,
      gid: section.gid,
      tasks,
    });
  }

  return sectionData;
}
