import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

// Map common Asana section names to ADLI dimensions
const SECTION_TO_ADLI: Record<string, string> = {
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

    // Fetch project details
    const project = await asanaFetch(
      token,
      `/projects/${projectGid}?opt_fields=name,notes,html_notes,owner.name`
    );

    // Fetch sections
    const sectionsRes = await asanaFetch(
      token,
      `/projects/${projectGid}/sections?opt_fields=name`
    );
    const sections = sectionsRes.data;

    // Fetch tasks for each section
    const sectionData: { name: string; tasks: { name: string; notes: string; completed: boolean; assignee: string | null }[] }[] = [];

    for (const section of sections) {
      const tasksRes = await asanaFetch(
        token,
        `/sections/${section.gid}/tasks?opt_fields=name,notes,completed,assignee.name&limit=100`
      );
      sectionData.push({
        name: section.name,
        tasks: tasksRes.data.map(
          (t: { name: string; notes: string; completed: boolean; assignee?: { name: string } }) => ({
            name: t.name,
            notes: t.notes || "",
            completed: t.completed,
            assignee: t.assignee?.name || null,
          })
        ),
      });
    }

    // Build the process fields from Asana data
    const projectName = project.data.name;
    const projectNotes = project.data.notes || "";
    const ownerName = project.data.owner?.name || null;

    // Build a full markdown document from all Asana content
    // This becomes the charter.content — a rich, readable representation
    const contentParts: string[] = [];
    if (projectNotes) {
      contentParts.push(`## Overview\n\n${projectNotes}`);
    }

    // Collect all unique assignees as stakeholders
    const assignees = new Set<string>();

    for (const section of sectionData) {
      const sectionLabel = section.name && section.name !== "(no section)"
        ? section.name
        : "General Tasks";

      if (section.tasks.length > 0) {
        const taskLines = section.tasks.map((t) => {
          if (t.assignee) assignees.add(t.assignee);
          const assignee = t.assignee ? ` *(${t.assignee})*` : "";
          const status = t.completed ? " ~~done~~" : "";
          const line = `- **${t.name}**${assignee}${status}`;
          return t.notes ? `${line}\n  ${t.notes}` : line;
        }).join("\n");
        contentParts.push(`## ${sectionLabel}\n\n${taskLines}`);
      }
    }

    const fullContent = contentParts.join("\n\n---\n\n");

    // Charter: full overview in content, first paragraph as purpose
    const charter = {
      purpose: projectNotes || null,
      scope_includes: null,
      scope_excludes: null,
      stakeholders: Array.from(assignees),
      mission_alignment: null,
      content: fullContent || null,
    };

    // Map sections to ADLI dimensions if names match
    const adliFields: Record<string, { content: string }> = {};

    for (const section of sectionData) {
      if (!section.name || section.name === "(no section)") continue;
      const adliField = matchAdliDimension(section.name);
      if (adliField && section.tasks.length > 0) {
        const taskLines = section.tasks
          .map((t) => {
            const assignee = t.assignee ? ` (${t.assignee})` : "";
            const line = `- ${t.name}${assignee}`;
            return t.notes ? `${line}\n  ${t.notes}` : line;
          })
          .join("\n");
        adliFields[adliField] = {
          content: `## ${section.name}\n\n${taskLines}`,
        };
      }
    }

    const hasAdli = Object.keys(adliFields).length > 0;

    // Always use "full" template — AI can work with it better
    const templateType = "full";

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
      template_type: templateType,
      owner: ownerName,
      charter,
      adli_approach: adliFields.adli_approach || null,
      adli_deployment: adliFields.adli_deployment || null,
      adli_learning: adliFields.adli_learning || null,
      adli_integration: adliFields.adli_integration || null,
      workflow: null,
      asana_project_gid: projectGid,
      asana_project_url: `https://app.asana.com/0/${projectGid}`,
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
      templateType,
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
