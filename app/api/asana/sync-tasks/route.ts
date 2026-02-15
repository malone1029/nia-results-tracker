import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken } from "@/lib/asana";
import { syncProcessTasks } from "@/lib/asana-sync";

export const maxDuration = 60;

/**
 * POST /api/asana/sync-tasks
 * Imports ALL tasks from a linked Asana project into process_tasks.
 * Body: { processId: number }
 * Returns: { imported, updated, removed, total, lastSyncedAt }
 */
export async function POST(request: Request) {
  const { processId } = await request.json();

  if (!processId) {
    return NextResponse.json(
      { error: "processId is required" },
      { status: 400 }
    );
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
      {
        error: "not_connected",
        message: "Asana not connected. Go to Settings to connect.",
      },
      { status: 401 }
    );
  }

  // Fetch process to get the linked Asana project GID
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
      {
        error: "not_linked",
        message: "This process is not linked to an Asana project.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await syncProcessTasks(
      supabase,
      token,
      proc.id,
      proc.name,
      proc.asana_project_gid
    );

    return NextResponse.json(result);
  } catch (err) {
    const errMsg = (err as Error).message || "";

    if (
      errMsg.includes("Unknown object") ||
      errMsg.includes("Not Found") ||
      errMsg.includes("404")
    ) {
      return NextResponse.json(
        {
          error: "not_linked",
          message: "The linked Asana project no longer exists.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
