import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  try {
    const body = await request.json();
    const { processId, action } = body;

    if (!processId || !action) {
      return Response.json(
        { error: "processId and action are required" },
        { status: 400 }
      );
    }

    if (action === "link") {
      // Link an existing metric to the process
      const { metricId } = body;
      if (!metricId) {
        return Response.json(
          { error: "metricId is required for link action" },
          { status: 400 }
        );
      }

      // Check if already linked
      const { data: existing } = await supabase
        .from("metric_processes")
        .select("id")
        .eq("metric_id", metricId)
        .eq("process_id", processId)
        .maybeSingle();

      if (existing) {
        return Response.json(
          { error: "This metric is already linked to this process" },
          { status: 409 }
        );
      }

      // Insert junction row
      const { error: linkError } = await supabase
        .from("metric_processes")
        .insert({ metric_id: metricId, process_id: processId });

      if (linkError) {
        return Response.json(
          { error: linkError.message },
          { status: 500 }
        );
      }

      // Fetch metric name for the success response
      const { data: metric } = await supabase
        .from("metrics")
        .select("name")
        .eq("id", metricId)
        .single();

      return Response.json({
        success: true,
        action: "linked",
        metricId,
        metricName: metric?.name || "Metric",
      });
    }

    if (action === "create") {
      // Create a new metric and link it to the process
      const { metric } = body;
      if (!metric || !metric.name || !metric.unit || !metric.cadence) {
        return Response.json(
          { error: "metric object with name, unit, and cadence is required for create action" },
          { status: 400 }
        );
      }

      // Insert new metric
      const { data: newMetric, error: createError } = await supabase
        .from("metrics")
        .insert({
          name: metric.name,
          unit: metric.unit,
          cadence: metric.cadence,
          target_value: metric.targetValue ?? null,
          is_higher_better: metric.isHigherBetter ?? true,
        })
        .select("id, name")
        .single();

      if (createError || !newMetric) {
        return Response.json(
          { error: createError?.message || "Failed to create metric" },
          { status: 500 }
        );
      }

      // Link to process
      const { error: linkError } = await supabase
        .from("metric_processes")
        .insert({ metric_id: newMetric.id, process_id: processId });

      if (linkError) {
        return Response.json(
          { error: linkError.message },
          { status: 500 }
        );
      }

      return Response.json({
        success: true,
        action: "created",
        metricId: newMetric.id,
        metricName: newMetric.name,
      });
    }

    return Response.json(
      { error: "Invalid action. Use 'link' or 'create'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("AI metrics error:", error);
    return Response.json(
      { error: "Failed to process metric action" },
      { status: 500 }
    );
  }
}
