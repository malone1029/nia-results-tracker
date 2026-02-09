import { createSupabaseServer } from "@/lib/supabase-server";

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
    const { processId, field, content, suggestionTitle, whyMatters, tasks } = await request.json();

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
    try {
      await supabase.from("process_improvements").insert({
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
      });
    } catch { /* non-critical — don't block the main update */ }

    // Queue tasks from the suggestion into process_tasks (pending for review)
    let tasksQueued = 0;
    if (Array.isArray(tasks) && tasks.length > 0) {
      try {
        const taskRows = tasks.map((t: { title: string; description?: string; pdcaSection: string; adliDimension?: string }) => ({
          process_id: processId,
          title: t.title,
          description: t.description || null,
          pdca_section: t.pdcaSection,
          adli_dimension: t.adliDimension || null,
          source: "ai_suggestion",
          source_detail: suggestionTitle || null,
        }));

        const { data: insertedTasks, error: taskError } = await supabase
          .from("process_tasks")
          .insert(taskRows)
          .select("id");

        if (!taskError && insertedTasks) {
          tasksQueued = insertedTasks.length;
        }
      } catch (taskErr) {
        console.error("Task queuing failed (non-blocking):", taskErr);
        // Non-blocking: the process text update still succeeded
      }
    }

    return Response.json({
      success: true,
      field: fieldLabel,
      tasksQueued,
    });
  } catch (error) {
    console.error("Apply suggestion error:", error);
    return Response.json(
      { error: "Failed to apply suggestion" },
      { status: 500 }
    );
  }
}
