import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

// Map common Asana section names to ADLI dimensions
// Includes both ADLI names and PDCA names (Plan/Execute/Evaluate/Improve)
const SECTION_TO_ADLI: Record<string, string> = {
  // ADLI dimension names
  approach: "adli_approach",
  "how we do it": "adli_approach",
  methodology: "adli_approach",
  method: "adli_approach",
  deployment: "adli_deployment",
  implementation: "adli_deployment",
  rollout: "adli_deployment",
  "who does it": "adli_deployment",
  learning: "adli_learning",
  measurement: "adli_learning",
  metrics: "adli_learning",
  "how we improve": "adli_learning",
  integration: "adli_integration",
  alignment: "adli_integration",
  connections: "adli_integration",
  "how it connects": "adli_integration",
  // PDCA cycle names (Plan/Execute/Evaluate/Improve)
  plan: "adli_approach",
  planning: "adli_approach",
  execute: "adli_deployment",
  execution: "adli_deployment",
  do: "adli_deployment",
  evaluate: "adli_learning",
  evaluation: "adli_learning",
  check: "adli_learning",
  improve: "adli_integration",
  improvement: "adli_integration",
  improvements: "adli_integration",
  act: "adli_integration",
};

function matchAdliDimension(sectionName: string): string | null {
  const lower = sectionName.toLowerCase().trim();
  // Direct match
  if (SECTION_TO_ADLI[lower]) return SECTION_TO_ADLI[lower];
  // Partial match
  for (const [key, value] of Object.entries(SECTION_TO_ADLI)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

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

    // Fetch project details with expanded fields
    const project = await asanaFetch(
      token,
      `/projects/${projectGid}?opt_fields=name,notes,html_notes,owner.name,due_on,start_on,custom_fields,members.name`
    );

    // Fetch sections
    const sectionsRes = await asanaFetch(
      token,
      `/projects/${projectGid}/sections?opt_fields=name`
    );
    const sections = sectionsRes.data;

    // Fetch tasks for each section with expanded fields (including subtasks)
    type SubtaskData = { name: string; notes: string; completed: boolean; assignee: string | null; due_on: string | null };
    type TaskData = { name: string; notes: string; completed: boolean; assignee: string | null; due_on: string | null; num_subtasks: number; permalink_url: string | null; subtasks: SubtaskData[] };
    const sectionData: { name: string; gid: string; tasks: TaskData[] }[] = [];

    for (const section of sections) {
      const tasksRes = await asanaFetch(
        token,
        `/sections/${section.gid}/tasks?opt_fields=name,notes,completed,assignee.name,due_on,due_at,num_subtasks,permalink_url,custom_fields&limit=100`
      );

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const tasks: TaskData[] = [];
      for (const t of tasksRes.data as any[]) {
        // Fetch subtasks if this task has any
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
            // Non-blocking: if subtask fetch fails, continue without them
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

    // Build a section summary (just section names + task counts) for the charter
    const sectionSummaryParts: string[] = [];
    for (const section of sectionData) {
      for (const t of section.tasks) {
        if (t.assignee) assignees.add(t.assignee);
      }
      if (section.name && section.name !== "(no section)" && section.tasks.length > 0) {
        sectionSummaryParts.push(`- **${section.name}** (${section.tasks.length} tasks)`);
      }
    }

    // Charter: only the project overview text — NOT all the tasks
    // Tasks stay in Asana as tasks; we don't duplicate them in the charter
    const charterContent = projectNotes
      ? (sectionSummaryParts.length > 0
        ? `${projectNotes}\n\n## Asana Project Sections\n\n${sectionSummaryParts.join("\n")}`
        : projectNotes)
      : null;

    const charter = {
      purpose: projectNotes || null,
      scope_includes: null,
      scope_excludes: null,
      stakeholders: Array.from(assignees),
      mission_alignment: null,
      content: charterContent,
    };

    // Map sections to ADLI dimensions if names match
    const adliFields: Record<string, { content: string }> = {};

    for (const section of sectionData) {
      if (!section.name || section.name === "(no section)") continue;
      const adliField = matchAdliDimension(section.name);
      if (adliField && section.tasks.length > 0) {
        const taskLines = section.tasks
          .map((t) => {
            const parts: string[] = [];
            if (t.assignee) parts.push(t.assignee);
            if (t.due_on) parts.push(`due ${t.due_on}`);
            if (t.completed) parts.push("done");
            const meta = parts.length > 0 ? ` (${parts.join(", ")})` : "";
            const line = `- ${t.completed ? "~~" : ""}${t.name}${t.completed ? "~~" : ""}${meta}`;
            let result = t.notes ? `${line}\n  ${t.notes}` : line;
            // Include subtasks indented under parent
            if (t.subtasks && t.subtasks.length > 0) {
              for (const sub of t.subtasks) {
                const subParts: string[] = [];
                if (sub.assignee) subParts.push(sub.assignee);
                if (sub.due_on) subParts.push(`due ${sub.due_on}`);
                if (sub.completed) subParts.push("done");
                const subMeta = subParts.length > 0 ? ` (${subParts.join(", ")})` : "";
                result += `\n  - ${sub.completed ? "~~" : ""}${sub.name}${sub.completed ? "~~" : ""}${subMeta}`;
              }
            }
            return result;
          })
          .join("\n");
        adliFields[adliField] = {
          content: `## ${section.name}\n\n${taskLines}`,
        };
      }
    }

    // Short description for the list view (first sentence or 200 chars)
    const shortDesc = projectNotes
      ? projectNotes.split(/[.!?]\s/)[0].slice(0, 200)
      : null;

    // Build process data
    const processData: Record<string, unknown> = {
      name: projectName,
      category_id: 6, // Default to Operations; user can change later
      description: shortDesc,
      status: "draft",
      template_type: "full",
      owner: ownerName,
      charter,
      adli_approach: adliFields.adli_approach || null,
      adli_deployment: adliFields.adli_deployment || null,
      adli_learning: adliFields.adli_learning || null,
      adli_integration: adliFields.adli_integration || null,
      workflow: null,
      asana_project_gid: projectGid,
      asana_project_url: `https://app.asana.com/0/${projectGid}`,
      asana_raw_data: asanaRawData,
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
      adliMapped: Object.keys(adliFields).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
