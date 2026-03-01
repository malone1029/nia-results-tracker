/**
 * Shared Asana helpers used by import, resync, and export routes.
 * Centralizes ADLI task detection and data types to avoid duplication.
 */

import { asanaFetch } from './asana';

// ── Types ────────────────────────────────────────────────────

export interface SubtaskData {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  assignee: string | null;
  assignee_gid: string | null;
  completed_at: string | null;
  start_on: string | null;
  due_on: string | null;
}

export interface TaskData {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  assignee: string | null;
  assignee_gid: string | null;
  completed_at: string | null;
  start_on: string | null;
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
  '[adli: approach]': 'approach',
  '[adli: deployment]': 'deployment',
  '[adli: learning]': 'learning',
  '[adli: integration]': 'integration',
};

/** Canonical task names for export (what we create in Asana) */
export const ADLI_TASK_NAMES: Record<string, string> = {
  approach: '[ADLI: Approach] How We Do It',
  deployment: '[ADLI: Deployment] How We Roll It Out',
  learning: '[ADLI: Learning] How We Improve',
  integration: '[ADLI: Integration] How It Connects',
};

/** ADLI-to-PDCA section mapping for task placement in Asana */
export const ADLI_TO_PDCA_SECTION: Record<string, string> = {
  approach: 'plan',
  deployment: 'execute',
  learning: 'evaluate',
  integration: 'improve',
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
 * Fetch all pages of a paginated Asana API endpoint.
 * Asana returns max 100 items per request with a `next_page.offset` for pagination.
 */
async function fetchAllPages(token: string, endpoint: string): Promise<any[]> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const allData: any[] = [];
  let url = endpoint.includes('?') ? `${endpoint}&limit=100` : `${endpoint}?limit=100`;

  while (url) {
    const res = await asanaFetch(token, url);
    allData.push(...(res.data || []));
    url = res.next_page?.uri ? res.next_page.uri.replace('https://app.asana.com/api/1.0', '') : '';
  }

  return allData;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Fetch all sections and their tasks (with subtasks) for an Asana project.
 * Shared between import, resync, and task sync routes.
 * Handles Asana API pagination for projects with 100+ tasks per section.
 */
export async function fetchProjectSections(
  token: string,
  projectGid: string
): Promise<SectionData[]> {
  const sectionsRes = await asanaFetch(token, `/projects/${projectGid}/sections?opt_fields=name`);
  const sections = sectionsRes.data;

  const sectionData: SectionData[] = [];

  for (const section of sections) {
    const taskFields =
      'name,notes,completed,completed_at,assignee.name,assignee.gid,start_on,due_on,due_at,num_subtasks,permalink_url,custom_fields';
    const allTasks = await fetchAllPages(
      token,
      `/sections/${section.gid}/tasks?opt_fields=${taskFields}`
    );

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const tasks: TaskData[] = [];
    for (const t of allTasks as any[]) {
      let subtasks: SubtaskData[] = [];
      if (t.num_subtasks > 0) {
        try {
          const subtaskFields =
            'name,notes,completed,completed_at,assignee.name,assignee.gid,start_on,due_on';
          const subData = await fetchAllPages(
            token,
            `/tasks/${t.gid}/subtasks?opt_fields=${subtaskFields}`
          );
          subtasks = subData.map((s: any) => ({
            gid: s.gid,
            name: s.name,
            notes: s.notes || '',
            completed: s.completed,
            assignee: s.assignee?.name || null,
            assignee_gid: s.assignee?.gid || null,
            completed_at: s.completed_at || null,
            start_on: s.start_on || null,
            due_on: s.due_on || null,
          }));
        } catch {
          // Non-blocking: continue without subtasks if fetch fails
        }
      }

      tasks.push({
        gid: t.gid,
        name: t.name,
        notes: t.notes || '',
        completed: t.completed,
        assignee: t.assignee?.name || null,
        assignee_gid: t.assignee?.gid || null,
        completed_at: t.completed_at || null,
        start_on: t.start_on || null,
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
