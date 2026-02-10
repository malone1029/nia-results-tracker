import { createSupabaseServer } from "@/lib/supabase-server";

// GET: Fetch all readiness snapshots ordered by date
export async function GET() {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("readiness_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: true });

  if (error) {
    return Response.json({ error: "Failed to fetch snapshots" }, { status: 500 });
  }

  return Response.json(data || []);
}

// POST: Take a readiness snapshot (upsert — one per day)
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const body = await request.json();
  const { org_score, category_scores, dimension_scores, process_count, ready_count } = body;

  if (org_score === undefined || !category_scores || !dimension_scores) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Upsert: if snapshot already exists for today, update it
  const { data, error } = await supabase
    .from("readiness_snapshots")
    .upsert(
      {
        snapshot_date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        org_score,
        category_scores,
        dimension_scores,
        process_count: process_count || 0,
        ready_count: ready_count || 0,
      },
      { onConflict: "snapshot_date" }
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: "Failed to save snapshot" }, { status: 500 });
  }

  return Response.json(data);
}
