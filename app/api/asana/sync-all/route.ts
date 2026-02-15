import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken } from "@/lib/asana";
import { syncProcessTasks, type SyncResult } from "@/lib/asana-sync";

export const maxDuration = 300;

/**
 * POST /api/asana/sync-all
 * Admin-only: syncs all Asana-linked processes sequentially.
 * Processes are synced with a 1-second delay between each to avoid Asana rate limits.
 * Returns: { results: SyncResult[], summary: { total, synced, failed } }
 */
export async function POST() {
  const supabase = await createSupabaseServer();

  // Auth + admin check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (roleData?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const token = await getAsanaToken(user.id);
  if (!token) {
    return NextResponse.json(
      {
        error: "not_connected",
        message: "Asana not connected. Connect Asana in Settings first.",
      },
      { status: 401 }
    );
  }

  // Fetch all processes with linked Asana projects
  const { data: processes, error: procError } = await supabase
    .from("processes")
    .select("id, name, asana_project_gid")
    .not("asana_project_gid", "is", null)
    .order("name");

  if (procError) {
    return NextResponse.json({ error: procError.message }, { status: 500 });
  }

  if (!processes || processes.length === 0) {
    return NextResponse.json({
      results: [],
      summary: { total: 0, synced: 0, failed: 0 },
    });
  }

  // Sync each process sequentially with delay
  const results: SyncResult[] = [];

  for (let i = 0; i < processes.length; i++) {
    const proc = processes[i];

    try {
      const result = await syncProcessTasks(
        supabase,
        token,
        proc.id,
        proc.name,
        proc.asana_project_gid
      );
      results.push(result);
    } catch (err) {
      results.push({
        processId: proc.id,
        processName: proc.name,
        imported: 0,
        updated: 0,
        removed: 0,
        total: 0,
        lastSyncedAt: new Date().toISOString(),
        error: (err as Error).message || "Unknown error",
      });
    }

    // 1-second delay between syncs to respect Asana rate limits (skip after last)
    if (i < processes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const synced = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => !!r.error).length;

  return NextResponse.json({
    results,
    summary: {
      total: processes.length,
      synced,
      failed,
    },
  });
}
