import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

/**
 * POST /api/asana/resync
 * Re-fetches Asana project data (with subtasks) and updates asana_raw_data
 * for an already-linked process. Does NOT overwrite charter or ADLI content.
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

  // Fetch the process to get the Asana project link
  const { data: proc, error: procError } = await supabase
    .from("processes")
    .select("id, name, asana_project_gid")
    .eq("id", processId)
    .single();

  if (procError || !proc) {
    return NextResponse.json({ error: "Process not found" }, { status: 404 });
  }

  if (!proc.asana_project_gid) {
    return NextResponse.json(
      { error: "not_linked", message: "This process is not linked to an Asana project." },
      { status: 400 }
    );
  }

  const projectGid = proc.asana_project_gid;

  try {
    // Verify project still exists
    const project = await asanaFetch(
      token,
      `/projects/${projectGid}?opt_fields=name,notes,html_notes,owner.name,due_on,start_on,members.name`
    );

    // Fetch sections
    const sectionsRes = await asanaFetch(
      token,
      `/projects/${projectGid}/sections?opt_fields=name`
    );
    const sections = sectionsRes.data;

    // Fetch tasks for each section (including subtasks)
    type SubtaskData = { name: string; notes: string; completed: boolean; assignee: string | null; due_on: string | null };
    type TaskData = { name: string; notes: string; completed: boolean; assignee: string | null; due_on: string | null; num_subtasks: number; permalink_url: string | null; subtasks: SubtaskData[] };
    const sectionData: { name: string; gid: string; tasks: TaskData[] }[] = [];

    for (const section of sections) {
      const tasksRes = await asanaFetch(
        token,
        `/sections/${section.gid}/tasks?opt_fields=name,notes,completed,assignee.name,due_on,due_at,num_subtasks,permalink_url&limit=100`
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

    // Build updated raw data
    const asanaRawData = {
      project: project.data,
      sections: sectionData,
      fetched_at: new Date().toISOString(),
    };

    // Count subtasks for the summary
    let totalTasks = 0;
    let totalSubtasks = 0;
    for (const section of sectionData) {
      totalTasks += section.tasks.length;
      for (const task of section.tasks) {
        totalSubtasks += task.subtasks.length;
      }
    }

    // Update only asana_raw_data — don't touch charter/ADLI content
    const { error: updateError } = await supabase
      .from("processes")
      .update({ asana_raw_data: asanaRawData })
      .eq("id", processId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log in history
    await supabase.from("process_history").insert({
      process_id: processId,
      change_description: `Refreshed Asana data (${totalTasks} tasks, ${totalSubtasks} subtasks) by ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      sections: sectionData.length,
      tasks: totalTasks,
      subtasks: totalSubtasks,
    });
  } catch (err) {
    const errMsg = (err as Error).message || "";
    if (errMsg.includes("Unknown object") || errMsg.includes("Not Found") || errMsg.includes("404")) {
      return NextResponse.json(
        { error: "not_linked", message: "The linked Asana project no longer exists." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
