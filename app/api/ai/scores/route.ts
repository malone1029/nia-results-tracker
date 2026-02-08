import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Fetch scores for one process or all processes
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");

  if (processId) {
    // Single process scores
    const { data, error } = await supabase
      .from("process_adli_scores")
      .select("*")
      .eq("process_id", processId)
      .single();

    if (error && error.code !== "PGRST116") {
      return Response.json({ error: "Failed to fetch scores" }, { status: 500 });
    }
    return Response.json(data || null);
  }

  // All process scores with process name and category info
  const { data, error } = await supabase
    .from("process_adli_scores")
    .select(`
      *,
      processes!inner (
        id, name, status, is_key, owner,
        categories!inner ( id, display_name, sort_order )
      )
    `)
    .order("assessed_at", { ascending: false });

  if (error) {
    console.error("Fetch all scores error:", error);
    return Response.json({ error: "Failed to fetch scores" }, { status: 500 });
  }

  return Response.json(data || []);
}

// POST: Save or update scores for a process (upsert)
export async function POST(request: Request) {
  try {
    const { processId, approach, deployment, learning, integration } = await request.json();

    if (!processId || approach == null || deployment == null || learning == null || integration == null) {
      return Response.json(
        { error: "processId and all four scores are required" },
        { status: 400 }
      );
    }

    const overall = Math.round((approach + deployment + learning + integration) / 4);

    const { error } = await supabase
      .from("process_adli_scores")
      .upsert(
        {
          process_id: processId,
          approach_score: approach,
          deployment_score: deployment,
          learning_score: learning,
          integration_score: integration,
          overall_score: overall,
          assessed_at: new Date().toISOString(),
        },
        { onConflict: "process_id" }
      );

    if (error) {
      console.error("Save scores error:", error);
      return Response.json({ error: "Failed to save scores" }, { status: 500 });
    }

    return Response.json({ success: true, overall });
  } catch (error) {
    console.error("Scores API error:", error);
    return Response.json({ error: "Failed to save scores" }, { status: 500 });
  }
}
