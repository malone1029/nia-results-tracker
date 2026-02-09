import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";
import { fetchProjectSections, findAdliTasks } from "@/lib/asana-helpers";

export async function POST(request: Request) {
  const { projectGid } = await request.json();

  if (!projectGid) {
    return NextResponse.json({ error: "projectGid is required" }, { status: 400 });
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
    return NextResponse.json({ error: "Asana not connected" }, { status: 401 });
  }

  try {
    // Check if this project was already imported
    const { data: existing } = await supabase
      .from("processes")
      .select("id, name")
      .eq("asana_project_gid", projectGid)
      .single();

    if (existing) {
      return NextResponse.json({
        error: "already_exists",
        existingId: existing.id,
        existingName: existing.name,
      }, { status: 409 });
    }

    // Fetch project details
    const project = await asanaFetch(
      token,
      `/projects/${projectGid}?opt_fields=name,notes,html_notes,owner.name,due_on,start_on,custom_fields,members.name`
    );

    // Fetch all sections and tasks using shared helper
    const sectionData = await fetchProjectSections(token, projectGid);

    // Store full raw Asana data for AI context
    const asanaRawData = {
      project: project.data,
      sections: sectionData,
      fetched_at: new Date().toISOString(),
    };

    // Build the process fields from Asana data
    const projectName = project.data.name;
    const projectNotes = project.data.notes || "";
    const ownerName = project.data.owner?.name || null;

    // Collect all unique assignees as stakeholders
    const assignees = new Set<string>();
    for (const section of sectionData) {
      for (const t of section.tasks) {
        if (t.assignee) assignees.add(t.assignee);
      }
    }

    // Charter: only the project overview text — NOT all the tasks
    const charter = {
      purpose: projectNotes || null,
      scope_includes: null,
      scope_excludes: null,
      stakeholders: Array.from(assignees),
      mission_alignment: null,
      content: projectNotes || null,
    };

    // Look for ADLI documentation tasks by name prefix
    // These are tasks named "[ADLI: Approach] ...", "[ADLI: Deployment] ...", etc.
    // Their descriptions contain the process write-up (not task lists)
    const adliTasks = findAdliTasks(sectionData);

    // Build ADLI fields from ADLI task descriptions (not section task lists)
    const adliFields: Record<string, { content: string } | null> = {
      adli_approach: null,
      adli_deployment: null,
      adli_learning: null,
      adli_integration: null,
    };

    // Build GID map for tracking which Asana tasks hold ADLI content
    const adliTaskGids: Record<string, string> = {};

    for (const [dimension, taskInfo] of Object.entries(adliTasks)) {
      const fieldKey = `adli_${dimension}`;
      if (taskInfo.notes.trim()) {
        adliFields[fieldKey] = { content: taskInfo.notes };
      }
      adliTaskGids[dimension] = taskInfo.gid;
    }

    // Short description for the list view (first sentence or 200 chars)
    const shortDesc = projectNotes
      ? projectNotes.split(/[.!?]\s/)[0].slice(0, 200)
      : null;

    // Determine starting guided step based on what content was found
    // If ADLI tasks found → start at assessment; otherwise → start at charter
    const guidedStep = Object.keys(adliTasks).length > 0 ? "assessment" : "charter";

    // Build process data
    const processData: Record<string, unknown> = {
      name: projectName,
      category_id: 6, // Default to Operations; user can change later
      description: shortDesc,
      status: "draft",
      template_type: "full",
      owner: ownerName,
      charter,
      adli_approach: adliFields.adli_approach,
      adli_deployment: adliFields.adli_deployment,
      adli_learning: adliFields.adli_learning,
      adli_integration: adliFields.adli_integration,
      workflow: null,
      asana_project_gid: projectGid,
      asana_project_url: `https://app.asana.com/0/${projectGid}`,
      asana_raw_data: asanaRawData,
      asana_adli_task_gids: adliTaskGids,
      guided_step: guidedStep,
    };

    // Insert into database
    const { data: newProcess, error: insertError } = await supabase
      .from("processes")
      .insert(processData)
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Log in history
    await supabase.from("process_history").insert({
      process_id: newProcess.id,
      change_description: `Imported from Asana project "${projectName}" by ${user.email}`,
    });

    return NextResponse.json({
      id: newProcess.id,
      name: projectName,
      templateType: "full",
      sectionsImported: sectionData.length,
      adliFound: Object.keys(adliTasks).length,
      guidedStep,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
