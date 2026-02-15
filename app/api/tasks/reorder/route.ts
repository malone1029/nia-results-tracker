import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAsanaToken, asanaFetch } from "@/lib/asana";
import { PDCA_SECTION_VALUES, PDCA_SECTIONS } from "@/lib/pdca";
import type { PdcaSection } from "@/lib/types";

// ── Per-user rate limiter ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 30;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

interface ReorderUpdate {
  id: number;
  sort_order: number;
  pdca_section?: string;
}

/**
 * PATCH /api/tasks/reorder — Batch update sort_order (and optionally pdca_section).
 *
 * Used by drag-and-drop to persist new task ordering.
 * For Asana tasks that change pdca_section, moves them to the new Asana section.
 */
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const updates: ReorderUpdate[] = body.updates;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      { error: "updates array is required" },
      { status: 400 }
    );
  }

  // Validate all entries
  for (const u of updates) {
    if (!u.id || typeof u.sort_order !== "number") {
      return NextResponse.json(
        { error: "Each update requires id (number) and sort_order (number)" },
        { status: 400 }
      );
    }
    if (u.pdca_section !== undefined && !PDCA_SECTION_VALUES.includes(u.pdca_section as PdcaSection)) {
      return NextResponse.json(
        { error: `Invalid pdca_section: ${u.pdca_section}` },
        { status: 400 }
      );
    }
  }

  // Apply updates in a loop (fine for ~20 tasks per process)
  const errors: string[] = [];
  for (const u of updates) {
    const fields: Record<string, unknown> = { sort_order: u.sort_order };
    if (u.pdca_section) {
      fields.pdca_section = u.pdca_section;
      fields.asana_section_name = PDCA_SECTIONS[u.pdca_section as PdcaSection].label;
    }

    const { error } = await supabase
      .from("process_tasks")
      .update(fields)
      .eq("id", u.id);

    if (error) {
      errors.push(`Task ${u.id}: ${error.message}`);
    }
  }

  // For Asana tasks that changed section, move them in Asana (best-effort)
  const sectionChanges = updates.filter((u) => u.pdca_section);
  if (sectionChanges.length > 0) {
    const token = await getAsanaToken(user.id);
    if (token) {
      // Fetch the tasks that changed to check which are Asana-origin
      const taskIds = sectionChanges.map((u) => u.id);
      const { data: asanaTasks } = await supabase
        .from("process_tasks")
        .select("id, origin, asana_task_gid, process_id")
        .in("id", taskIds)
        .eq("origin", "asana");

      if (asanaTasks && asanaTasks.length > 0) {
        // Look up Asana project for the process
        const processId = asanaTasks[0].process_id;
        const { data: proc } = await supabase
          .from("processes")
          .select("asana_project_gid")
          .eq("id", processId)
          .single();

        if (proc?.asana_project_gid) {
          try {
            const sectionsRes = await asanaFetch(
              token,
              `/projects/${proc.asana_project_gid}/sections?opt_fields=name`
            );
            const sectionMap = new Map<string, string>();
            for (const s of sectionsRes.data) {
              sectionMap.set(s.name.toLowerCase(), s.gid);
            }

            for (const at of asanaTasks) {
              const change = sectionChanges.find((u) => u.id === at.id);
              if (!change?.pdca_section || !at.asana_task_gid) continue;

              const targetLabel = PDCA_SECTIONS[change.pdca_section as PdcaSection].label.toLowerCase();
              const targetGid = sectionMap.get(targetLabel);
              if (targetGid) {
                await asanaFetch(token, `/sections/${targetGid}/addTask`, {
                  method: "POST",
                  body: JSON.stringify({ data: { task: at.asana_task_gid } }),
                }).catch(() => {
                  // Non-blocking — section move is best-effort
                });

                // Update the section GID in Supabase
                await supabase
                  .from("process_tasks")
                  .update({ asana_section_gid: targetGid })
                  .eq("id", at.id);
              }
            }
          } catch {
            // Non-blocking — section moves are best-effort during reorder
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors.join("; "), partial: true },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
