import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * GET /api/tasks/dashboard — Cross-process task data for the dashboard.
 *
 * Returns overdue, upcoming (next 14 days), recently completed tasks,
 * and aggregate stats. Supports ?owner=Name to filter to tasks on
 * processes owned by that person.
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ownerFilter = searchParams.get("owner");

  // Today at midnight for date comparisons
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // 14 days from now
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 14);
  const futureDateStr = futureDate.toISOString().split("T")[0];

  // Select fields we need, joining process name and owner
  const selectFields =
    "id, process_id, title, pdca_section, origin, assignee_name, due_date, completed, completed_at, processes!inner(name, owner)";

  // ── Overdue tasks: not completed, due_date < today ──
  let overdueQuery = supabase
    .from("process_tasks")
    .select(selectFields)
    .neq("status", "pending")
    .eq("completed", false)
    .lt("due_date", todayStr)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(10);

  if (ownerFilter) {
    overdueQuery = overdueQuery.eq("processes.owner", ownerFilter);
  }

  // ── Upcoming tasks: not completed, due_date between today and +14 days ──
  let upcomingQuery = supabase
    .from("process_tasks")
    .select(selectFields)
    .neq("status", "pending")
    .eq("completed", false)
    .gte("due_date", todayStr)
    .lte("due_date", futureDateStr)
    .order("due_date", { ascending: true })
    .limit(10);

  if (ownerFilter) {
    upcomingQuery = upcomingQuery.eq("processes.owner", ownerFilter);
  }

  // ── Recently completed tasks ──
  let completedQuery = supabase
    .from("process_tasks")
    .select(selectFields)
    .eq("completed", true)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(5);

  if (ownerFilter) {
    completedQuery = completedQuery.eq("processes.owner", ownerFilter);
  }

  // ── Stats: count all non-pending tasks ──
  let statsBaseQuery = supabase
    .from("process_tasks")
    .select(selectFields)
    .neq("status", "pending");

  if (ownerFilter) {
    statsBaseQuery = statsBaseQuery.eq("processes.owner", ownerFilter);
  }

  // Run all queries in parallel
  const [overdueRes, upcomingRes, completedRes, statsRes] = await Promise.all([
    overdueQuery,
    upcomingQuery,
    completedQuery,
    statsBaseQuery,
  ]);

  if (overdueRes.error || upcomingRes.error || completedRes.error || statsRes.error) {
    const err = overdueRes.error || upcomingRes.error || completedRes.error || statsRes.error;
    return NextResponse.json({ error: err!.message }, { status: 500 });
  }

  // Shape the joined data (Supabase returns processes as nested object)
  type RawRow = {
    id: number;
    process_id: number;
    title: string;
    pdca_section: string;
    origin: string;
    assignee_name: string | null;
    due_date: string | null;
    completed: boolean;
    completed_at: string | null;
    processes: { name: string; owner: string | null };
  };

  const shapeTask = (row: RawRow) => ({
    id: row.id,
    process_id: row.process_id,
    process_name: row.processes.name,
    title: row.title,
    pdca_section: row.pdca_section,
    origin: row.origin,
    assignee_name: row.assignee_name,
    due_date: row.due_date,
    completed: row.completed,
    completed_at: row.completed_at,
  });

  const overdue = (overdueRes.data as unknown as RawRow[]).map(shapeTask);
  const upcoming = (upcomingRes.data as unknown as RawRow[]).map(shapeTask);
  const recentlyCompleted = (completedRes.data as unknown as RawRow[]).map(shapeTask);

  // Compute stats from full result set
  const allTasks = statsRes.data as unknown as RawRow[];
  const totalActive = allTasks.filter((t) => !t.completed).length;
  const totalCompleted = allTasks.filter((t) => t.completed).length;
  const totalOverdue = allTasks.filter(
    (t) => !t.completed && t.due_date && t.due_date < todayStr
  ).length;
  const total = totalActive + totalCompleted;
  const completionRate = total > 0 ? Math.round((totalCompleted / total) * 100) : 0;
  const unassignedCount = allTasks.filter(
    (t) => !t.completed && !t.assignee_name
  ).length;

  return NextResponse.json({
    overdue,
    upcoming,
    recentlyCompleted,
    stats: {
      totalActive,
      totalCompleted,
      totalOverdue,
      completionRate,
      unassignedCount,
    },
  });
}
