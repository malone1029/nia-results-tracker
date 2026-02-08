import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fields that can be updated by the AI
const ALLOWED_FIELDS = [
  "charter",
  "adli_approach",
  "adli_deployment",
  "adli_learning",
  "adli_integration",
];

export async function POST(request: Request) {
  try {
    const { processId, field, content } = await request.json();

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
    const { data: process, error: fetchError } = await supabase
      .from("processes")
      .select("*")
      .eq("id", processId)
      .single();

    if (fetchError || !process) {
      return Response.json(
        { error: "Process not found" },
        { status: 404 }
      );
    }

    // Save the current version to process_history before changing it
    const previousValue = (process as Record<string, unknown>)[field];
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

    // Update the process field
    const { error: updateError } = await supabase
      .from("processes")
      .update({
        [field]: updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", processId);

    if (updateError) {
      console.error("Failed to update process:", updateError);
      return Response.json(
        { error: "Failed to update process" },
        { status: 500 }
      );
    }

    return Response.json({ success: true, field: fieldLabel });
  } catch (error) {
    console.error("Apply suggestion error:", error);
    return Response.json(
      { error: "Failed to apply suggestion" },
      { status: 500 }
    );
  }
}
