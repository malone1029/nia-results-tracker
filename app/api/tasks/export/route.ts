import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

export const maxDuration = 60;

// PDCA section names (same order as in the main Asana export)
const PDCA_SECTIONS = ["Plan", "Execute", "Evaluate", "Improve"];

// Map lowercase pdca_section values to capitalized section names
const SECTION_LABEL: Record<string, string> = {
  plan: "Plan",
  execute: "Execute",
  evaluate: "Evaluate",
  improve: "Improve",
};

// ADLI dimension labels for task name prefixes
const ADLI_LABELS: Record<string, string> = {
  approach: "Approach",
  deployment: "Deployment",
  learning: "Learning",
  integration: "Integration",
};

/**
 * POST /api/tasks/export
 * Exports all pending process_tasks to Asana.
 * Tasks with an adli_dimension become subtasks under the matching ADLI documentation task.
 * Tasks without adli_dimension (or when parent is missing) → standalone in PDCA section.
 * Body: { processId: number }
 */
export async function POST(request: Request) {
  const { processId } = await request.json();

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
    return NextResponse.json(
      { error: "not_connected", message: "Asana not connected. Go to Settings to connect." },
      { status: 401 }
    );
  }

  // Fetch the process (need asana_adli_task_gids for subtask placement)
  const { data: proc, error: procError } = await supabase
    .from("processes")
    .select("id, name, asana_project_gid, asana_adli_task_gids")
    .eq("id", processId)
    .single();

  if (procError || !proc) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  if (!proc.asana_project_gid) {
    return NextResponse.json(
      { error: "not_linked", message: "This process is not linked to an Asana project. Use the Asana export dialog to link or create a project first." },
      { status: 400 }
    );
  }

  // Fetch pending tasks
  const { data: pendingTasks, error: tasksError } = await supabase
    .from("process_tasks")
    .select("*")
    .eq("process_id", processId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  if (!pendingTasks || pendingTasks.length === 0) {
    return NextResponse.json({ error: "No pending tasks to export" }, { status: 400 });
  }

  const projectGid = proc.asana_project_gid;
  const adliTaskGids = (proc.asana_adli_task_gids as Record<string, string>) || {};
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nia-results-tracker.vercel.app";

  try {
    // Verify project still exists
    try {
      await asanaFetch(token, `/projects/${projectGid}?opt_fields=name`);
    } catch (err) {
      const errMsg = (err as Error).message || "";
      if (errMsg.includes("Unknown object") || errMsg.includes("Not Found") || errMsg.includes("404")) {
        return NextResponse.json(
          { error: "not_linked", message: "The linked Asana project no longer exists. Please re-link from the process page." },
          { status: 400 }
        );
      }
      throw err;
    }

    // Get existing sections (needed for standalone fallback)
    const sectionsRes = await asanaFetch(
      token,
      `/projects/${projectGid}/sections?opt_fields=name`
    );
    const existingSections = new Map<string, string>();
    for (const s of sectionsRes.data) {
      existingSections.set(s.name.toLowerCase(), s.gid);
    }

    // Create PDCA sections that don't exist yet
    for (const sectionName of PDCA_SECTIONS) {
      if (!existingSections.has(sectionName.toLowerCase())) {
        const newSection = await asanaFetch(token, `/projects/${projectGid}/sections`, {
          method: "POST",
          body: JSON.stringify({ data: { name: sectionName } }),
        });
        existingSections.set(sectionName.toLowerCase(), newSection.data.gid);
      }
    }

    // Export each task
    const results: { taskId: number; success: boolean; section: string; asSubtask: boolean }[] = [];

    for (const task of pendingTasks) {
      const sectionKey = task.pdca_section as string;
      const sectionGid = existingSections.get(sectionKey);
      const adliDim = task.adli_dimension as string | null;
      const parentGid = adliDim ? adliTaskGids[adliDim] : null;

      // Build task name with ADLI prefix if dimension is set
      const adliPrefix = adliDim
        ? `[ADLI: ${ADLI_LABELS[adliDim] || adliDim}] `
        : "";
      const taskName = `${adliPrefix}${task.title}`;

      // Build task notes
      const notesParts = [];
      if (task.description) notesParts.push(task.description);
      notesParts.push("");
      notesParts.push(`View process: ${appUrl}/processes/${processId}`);
      const taskNotes = notesParts.join("\n");

      let asSubtask = false;

      // Try to create as subtask under ADLI parent
      if (parentGid) {
        try {
          const result = await asanaFetch(token, `/tasks/${parentGid}/subtasks`, {
            method: "POST",
            body: JSON.stringify({
              data: {
                name: taskName,
                notes: taskNotes,
              },
            }),
          });

          const asanaTaskGid = result.data?.gid || null;
          const asanaTaskUrl = result.data?.permalink_url || null;

          await supabase
            .from("process_tasks")
            .update({
              status: "exported",
              asana_task_gid: asanaTaskGid,
              asana_task_url: asanaTaskUrl,
            })
            .eq("id", task.id);

          results.push({ taskId: task.id, success: true, section: sectionKey, asSubtask: true });
          asSubtask = true;
        } catch {
          // Parent task was deleted — fall through to standalone
        }
      }

      // Fallback: create as standalone task in PDCA section
      if (!asSubtask) {
        if (!sectionGid) {
          results.push({ taskId: task.id, success: false, section: sectionKey, asSubtask: false });
          continue;
        }

        try {
          const result = await asanaFetch(token, "/tasks", {
            method: "POST",
            body: JSON.stringify({
              data: {
                name: taskName,
                notes: taskNotes,
                memberships: [{ project: projectGid, section: sectionGid }],
              },
            }),
          });

          // Explicitly move to correct section (memberships alone can be unreliable)
          if (result.data?.gid) {
            await asanaFetch(token, `/sections/${sectionGid}/addTask`, {
              method: "POST",
              body: JSON.stringify({ data: { task: result.data.gid } }),
            }).catch(() => {}); // Non-blocking
          }

          const asanaTaskGid = result.data?.gid || null;
          const asanaTaskUrl = result.data?.permalink_url || null;

          await supabase
            .from("process_tasks")
            .update({
              status: "exported",
              asana_task_gid: asanaTaskGid,
              asana_task_url: asanaTaskUrl,
            })
            .eq("id", task.id);

          results.push({ taskId: task.id, success: true, section: sectionKey, asSubtask: false });
        } catch {
          results.push({ taskId: task.id, success: false, section: sectionKey, asSubtask: false });
        }
      }
    }

    // Build summary counts
    const exported = results.filter((r) => r.success);
    const subtaskCount = exported.filter((r) => r.asSubtask).length;
    const sectionCounts: Record<string, number> = {};
    for (const r of exported) {
      const label = SECTION_LABEL[r.section] || r.section;
      sectionCounts[label] = (sectionCounts[label] || 0) + 1;
    }

    // Log in history
    await supabase.from("process_history").insert({
      process_id: processId,
      change_description: `Exported ${exported.length} tasks to Asana by ${user.email} (${subtaskCount} as subtasks)`,
    });

    return NextResponse.json({
      success: true,
      exported: exported.length,
      failed: results.filter((r) => !r.success).length,
      subtasks: subtaskCount,
      sectionCounts,
      asanaUrl: `https://app.asana.com/0/${projectGid}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
