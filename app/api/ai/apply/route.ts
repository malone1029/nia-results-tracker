import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";

// Fields that can be updated by the AI
const ALLOWED_FIELDS = [
  "charter",
  "adli_approach",
  "adli_deployment",
  "adli_learning",
  "adli_integration",
];

// Map field names to improvement section names
const FIELD_TO_SECTION: Record<string, string> = {
  charter: "charter",
  adli_approach: "approach",
  adli_deployment: "deployment",
  adli_learning: "learning",
  adli_integration: "integration",
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  try {
    const { processId, field, content, suggestionTitle, whyMatters } = await request.json();

    if (!processId || !field || !content) {
      return Response.json(
        { error: "processId, field, and content are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return Response.json(
        { error: `Field "${field}" is not allowed. Must be one of: ${ALLOWED_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch current process to save the previous version
    const { data: currentProcess, error: fetchError } = await supabase
      .from("processes")
      .select("*")
      .eq("id", processId)
      .single();

    if (fetchError || !currentProcess) {
      return Response.json(
        { error: "Process not found" },
        { status: 404 }
      );
    }

    // Save the current version to process_history before changing it
    const previousValue = (currentProcess as Record<string, unknown>)[field];
    const fieldLabels: Record<string, string> = {
      charter: "Charter",
      adli_approach: "ADLI: Approach",
      adli_deployment: "ADLI: Deployment",
      adli_learning: "ADLI: Learning",
      adli_integration: "ADLI: Integration",
    };
    const fieldLabel = fieldLabels[field] || field;

    await supabase.from("process_history").insert({
      process_id: processId,
      change_description: `AI updated ${fieldLabel} section (previous version saved)`,
    });

    // Build the updated field value
    // The AI sends markdown content — store it in the `content` field of the JSONB
    // Preserve any existing structured fields and add/update the content field
    const existingData = (previousValue as Record<string, unknown>) || {};
    const updatedData = {
      ...existingData,
      content: content,
    };

    const updatePayload: Record<string, unknown> = {
      [field]: updatedData,
      updated_at: new Date().toISOString(),
    };

    // Update the process field
    const { error: updateError } = await supabase
      .from("processes")
      .update(updatePayload)
      .eq("id", processId);

    if (updateError) {
      console.error("Failed to update process:", updateError);
      return Response.json(
        { error: "Failed to update process" },
        { status: 500 }
      );
    }

    // Create improvement history entry with before/after snapshots
    const sectionName = FIELD_TO_SECTION[field] || field;
    let improvementId: number | null = null;
    try {
      const { data: impRow } = await supabase.from("process_improvements").insert({
        process_id: processId,
        section_affected: sectionName,
        change_type: previousValue ? "modification" : "addition",
        title: suggestionTitle || `AI updated ${fieldLabel}`,
        description: `Applied AI suggestion to ${fieldLabel} section`,
        trigger: "ai_suggestion",
        before_snapshot: previousValue || null,
        after_snapshot: updatedData,
        source: "ai_suggestion",
        status: "committed",
      }).select("id").single();
      if (impRow) improvementId = impRow.id;
    } catch { /* non-critical — don't block the main update */ }

    // Try to create an Asana task if the process is linked to an Asana project
    let asanaTaskCreated = false;
    let asanaTaskUrl: string | null = null;
    let asanaStatus: "created" | "not_linked" | "no_token" | "failed" = "not_linked";

    if (currentProcess.asana_project_gid) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          asanaStatus = "no_token";
        } else {
          const asanaToken = await getAsanaToken(user.id);
          if (!asanaToken) {
            asanaStatus = "no_token";
          } else {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nia-results-tracker.vercel.app";
            const taskName = `[${fieldLabel}] ${suggestionTitle || "AI improvement"}`;
            const taskNotes = [
              whyMatters || `Applied AI suggestion to ${fieldLabel} section.`,
              "",
              `View process: ${appUrl}/processes/${processId}`,
            ].join("\n");

            // Find the "Improve" section to place the task in
            const improveNames = ["improve", "act", "improvement", "improvements", "act (improve)"];
            let improveSectionGid: string | null = null;
            try {
              const sectionsRes = await asanaFetch(
                asanaToken,
                `/projects/${currentProcess.asana_project_gid}/sections?opt_fields=name`
              );
              for (const s of sectionsRes.data) {
                if (improveNames.includes(s.name.toLowerCase())) {
                  improveSectionGid = s.gid;
                  break;
                }
              }
            } catch { /* fall back to project root */ }

            // Build task data — place in Improve section if found
            const taskData: Record<string, unknown> = {
              name: taskName,
              notes: taskNotes,
              projects: [currentProcess.asana_project_gid],
            };
            if (improveSectionGid) {
              taskData.memberships = [{
                project: currentProcess.asana_project_gid,
                section: improveSectionGid,
              }];
            }

            const result = await asanaFetch(asanaToken, "/tasks", {
              method: "POST",
              body: JSON.stringify({ data: taskData }),
            });

            asanaTaskUrl = result.data?.permalink_url || null;
            asanaTaskCreated = true;
            asanaStatus = "created";

            // Store the Asana task URL in trigger_detail on the improvement record
            if (asanaTaskUrl && improvementId) {
              await supabase
                .from("process_improvements")
                .update({ trigger_detail: asanaTaskUrl })
                .eq("id", improvementId);
            }
          }
        }
      } catch (asanaErr) {
        console.error("Asana task creation failed (non-blocking):", asanaErr);
        asanaStatus = "failed";
      }
    }

    return Response.json({
      success: true,
      field: fieldLabel,
      asanaTaskCreated,
      asanaTaskUrl,
      asanaStatus,
    });
  } catch (error) {
    console.error("Apply suggestion error:", error);
    return Response.json(
      { error: "Failed to apply suggestion" },
      { status: 500 }
    );
  }
}
