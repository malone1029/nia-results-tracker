"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PDCA_SECTIONS } from "@/lib/pdca";
import HelpTip from "@/components/help-tip";
import Toast from "@/components/toast";
import TaskDetailPanel from "@/components/task-detail-panel";
import type { PdcaSection, ProcessTask } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────

const PDCA_KEYS: PdcaSection[] = ["plan", "execute", "evaluate", "improve"];
const SYNC_COOLDOWN_MS = 2 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 10 * 1000;

// Origin badge colors
const ORIGIN_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  asana:      { label: "Asana",         bg: "bg-nia-grey-blue/15", text: "text-nia-grey-blue" },
  hub_ai:     { label: "AI Suggestion", bg: "bg-nia-orange/15",    text: "text-nia-orange" },
  hub_manual: { label: "Manual",        bg: "bg-surface-muted",    text: "text-text-muted" },
};

// ── Helpers ──────────────────────────────────────────────────

function formatSyncTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(task: ProcessTask): boolean {
  if (!task.due_date || task.completed) return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.due_date < today;
}

/** Match Asana section name to a PDCA section (case-insensitive) */
function matchPdcaSection(sectionName: string): PdcaSection | null {
  const lower = sectionName.toLowerCase().trim();
  if (PDCA_KEYS.includes(lower as PdcaSection)) return lower as PdcaSection;
  return null;
}

/** Group tasks by section, preserving Asana section names with PDCA color matching */
interface TaskSection {
  key: string;           // unique key for React
  label: string;         // display name
  pdcaMatch: PdcaSection | null;  // PDCA match for color coding
  tasks: ProcessTask[];  // non-subtask tasks (subtasks are nested)
  completedCount: number;
  totalCount: number;
}

function buildSections(tasks: ProcessTask[]): TaskSection[] {
  // Separate tasks by origin type
  const asanaTasks = tasks.filter((t) => t.origin === "asana" && !t.is_subtask);
  const hubTasks = tasks.filter((t) => t.origin !== "asana" && t.status !== "pending");

  // Group Asana tasks by section name
  const asanaSectionMap = new Map<string, ProcessTask[]>();
  for (const t of asanaTasks) {
    const key = t.asana_section_name || "Uncategorized";
    if (!asanaSectionMap.has(key)) asanaSectionMap.set(key, []);
    asanaSectionMap.get(key)!.push(t);
  }

  const sections: TaskSection[] = [];

  // Asana sections (in order they appear)
  for (const [sectionName, sectionTasks] of asanaSectionMap) {
    const completedCount = sectionTasks.filter((t) => t.completed).length;
    // Count subtasks too
    const subtaskGids = sectionTasks.map((t) => t.asana_task_gid).filter(Boolean);
    const subtasks = tasks.filter((t) => t.is_subtask && t.parent_asana_gid && subtaskGids.includes(t.parent_asana_gid));
    const subtaskCompleted = subtasks.filter((t) => t.completed).length;

    sections.push({
      key: `asana-${sectionName}`,
      label: sectionName,
      pdcaMatch: matchPdcaSection(sectionName),
      tasks: sortTasks(sectionTasks),
      completedCount: completedCount + subtaskCompleted,
      totalCount: sectionTasks.length + subtasks.length,
    });
  }

  // Hub tasks grouped by PDCA section
  if (hubTasks.length > 0) {
    const hubByPdca = new Map<PdcaSection, ProcessTask[]>();
    for (const t of hubTasks) {
      const section = t.pdca_section;
      if (!hubByPdca.has(section)) hubByPdca.set(section, []);
      hubByPdca.get(section)!.push(t);
    }

    for (const key of PDCA_KEYS) {
      const sectionTasks = hubByPdca.get(key);
      if (!sectionTasks || sectionTasks.length === 0) continue;

      // Check if this PDCA section already exists as an Asana section
      const existingSection = sections.find((s) => s.pdcaMatch === key);
      if (existingSection) {
        // Merge hub tasks into the existing Asana section
        existingSection.tasks = sortTasks([...existingSection.tasks, ...sectionTasks]);
        existingSection.totalCount += sectionTasks.length;
        existingSection.completedCount += sectionTasks.filter((t) => t.status === "completed").length;
      } else {
        sections.push({
          key: `hub-${key}`,
          label: PDCA_SECTIONS[key].label,
          pdcaMatch: key,
          tasks: sortTasks(sectionTasks),
          completedCount: sectionTasks.filter((t) => t.status === "completed").length,
          totalCount: sectionTasks.length,
        });
      }
    }
  }

  return sections;
}

/** Sort tasks: active first, then completed (dimmed) */
function sortTasks(tasks: ProcessTask[]): ProcessTask[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return 0;
  });
}

// ── Main Component ──────────────────────────────────────────

interface TaskReviewPanelProps {
  processId: number;
  asanaProjectGid?: string | null;
  onTaskCountChange?: (count: number) => void;
}

export default function TaskReviewPanel({ processId, asanaProjectGid, onTaskCountChange }: TaskReviewPanelProps) {
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ exported: number; failed: number; sectionCounts: Record<string, number>; asanaUrl: string; errors?: string[] } | null>(null);
  const [error, setError] = useState("");

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const syncTriggeredRef = useRef(false);

  // Edit state
  const [togglingTaskIds, setTogglingTaskIds] = useState<Set<number>>(new Set());
  const [savingField, setSavingField] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [toastState, setToastState] = useState<{
    message: string;
    type: "error" | "success";
    retry?: () => void;
  } | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?processId=${processId}`);
      if (res.ok) {
        const data: ProcessTask[] = await res.json();
        setTasks(data);
        onTaskCountChange?.(data.filter((t) => t.status === "pending").length);

        const syncedTasks = data.filter((t) => t.last_synced_at);
        if (syncedTasks.length > 0) {
          const latest = syncedTasks.reduce((a, b) =>
            (a.last_synced_at! > b.last_synced_at!) ? a : b
          );
          setLastSyncedAt(latest.last_synced_at);
        }
      }
    } catch {
      setError("Failed to load tasks");
    }
    setLoading(false);
  }, [processId, onTaskCountChange]);

  const syncFromAsana = useCallback(async () => {
    if (!asanaProjectGid || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/asana/sync-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_connected") {
          setSyncError("Asana token expired. Reconnect in Settings.");
        } else {
          setSyncError(data.message || data.error || "Sync failed");
        }
        return;
      }
      setLastSyncedAt(data.lastSyncedAt);
      await fetchTasks();
    } catch {
      setSyncError("Couldn't refresh from Asana. Showing cached data.");
    } finally {
      setSyncing(false);
    }
  }, [asanaProjectGid, syncing, processId, fetchTasks]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    if (!asanaProjectGid || syncTriggeredRef.current) return;
    syncTriggeredRef.current = true;
    const shouldSync = !lastSyncedAt ||
      (Date.now() - new Date(lastSyncedAt).getTime() > SYNC_COOLDOWN_MS);
    if (shouldSync) syncFromAsana();
  }, [asanaProjectGid, lastSyncedAt, syncFromAsana]);

  function handleManualRefresh() {
    if (refreshCooldown || syncing) return;
    setRefreshCooldown(true);
    syncFromAsana();
    setTimeout(() => setRefreshCooldown(false), REFRESH_COOLDOWN_MS);
  }

  // ── Toggle completion (optimistic UI with revert) ──

  async function handleToggleComplete(taskId: number, currentCompleted: boolean) {
    // Snapshot for revert
    const snapshot = tasks.find((t) => t.id === taskId);
    if (!snapshot) return;

    const newCompleted = !currentCompleted;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
              status: newCompleted ? ("completed" as const) : ("active" as const),
            }
          : t
      )
    );
    setTogglingTaskIds((prev) => new Set(prev).add(taskId));

    const doToggle = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: newCompleted }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || data.error || "Update failed");
        }
      } catch (err) {
        // Revert
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? snapshot : t))
        );
        setToastState({
          message: (err as Error).message || "Couldn't update task. Please try again.",
          type: "error",
          retry: () => handleToggleComplete(taskId, currentCompleted),
        });
      } finally {
        setTogglingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    };

    doToggle();
  }

  // ── Generic update (optimistic UI with revert) ──

  async function handleUpdateTask(taskId: number, fields: Partial<ProcessTask>) {
    const snapshot = tasks.find((t) => t.id === taskId);
    if (!snapshot) return;

    // Determine which field we're saving (for "Saving..." indicator)
    const fieldName = Object.keys(fields)[0] || null;
    setSavingField(fieldName);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Update failed");
      }
    } catch (err) {
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? snapshot : t))
      );
      setToastState({
        message: (err as Error).message || "Couldn't update task. Please try again.",
        type: "error",
        retry: () => handleUpdateTask(taskId, fields),
      });
    } finally {
      setSavingField(null);
    }
  }

  // ── Delete task ──

  async function handleDeleteTask(taskId: number) {
    const snapshot = tasks.find((t) => t.id === taskId);
    if (!snapshot) return;

    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskId(null);

    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      setToastState({ message: "Task deleted", type: "success" });
    } catch {
      // Revert
      setTasks((prev) => [...prev, snapshot]);
      setToastState({
        message: "Couldn't delete task. Please try again.",
        type: "error",
        retry: () => handleDeleteTask(taskId),
      });
    }
  }

  // ── Keep / Dismiss for AI suggestions ──

  async function handleKeep(taskId: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: "active" }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "active" as const } : t))
        );
        onTaskCountChange?.(tasks.filter((t) => t.id !== taskId && t.status === "pending").length);
      }
    } catch {
      setError("Failed to keep task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDismiss(taskId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      if (res.ok) {
        const updated = tasks.filter((t) => t.id !== taskId);
        setTasks(updated);
        onTaskCountChange?.(updated.filter((t) => t.status === "pending").length);
      }
    } catch {
      setError("Failed to dismiss task");
    } finally {
      setSaving(false);
    }
  }

  // ── Export to Asana ──

  async function handleExportToAsana() {
    setExporting(true);
    setError("");
    setExportResult(null);
    try {
      const res = await fetch("/api/tasks/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_linked") {
          setError(data.message || "Process not linked to Asana.");
        } else if (data.error === "not_connected") {
          setError(data.message || "Asana not connected.");
        } else {
          setError(data.error || "Export failed");
        }
        return;
      }
      setExportResult(data);
      fetchTasks();
    } catch {
      setError("Export to Asana failed");
    } finally {
      setExporting(false);
    }
  }

  // ── Derived data ──

  const pendingSuggestions = tasks.filter((t) => t.origin === "hub_ai" && t.status === "pending");
  const sections = buildSections(tasks);
  const allSubtasks = tasks.filter((t) => t.is_subtask);
  const pendingCount = pendingSuggestions.length;
  // Tasks that can be synced to Asana: active hub tasks without an Asana GID
  const unsyncedTasks = tasks.filter(
    (t) => ["active", "pending"].includes(t.status) && !t.asana_task_gid && t.origin !== "asana"
  );

  // ── Loading state ──

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-surface-hover rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-surface-muted rounded w-32 mb-3" />
            <div className="space-y-2">
              <div className="h-14 bg-surface-muted rounded" />
              <div className="h-14 bg-surface-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ──

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-nia-dark mb-1">No tasks yet</h3>
        <p className="text-sm text-text-tertiary max-w-sm">
          {asanaProjectGid
            ? "Tasks will appear here after syncing from Asana, or use the AI coach to generate improvement suggestions."
            : "Link this process to an Asana project to import tasks, or use the AI coach to generate improvement suggestions."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export success banner */}
      {exportResult && (
        <div className="bg-nia-green/20 border border-nia-green rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-nia-dark">
                Created {exportResult.exported} task{exportResult.exported !== 1 ? "s" : ""} in Asana
                {exportResult.failed > 0 && ` (${exportResult.failed} failed)`}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {Object.entries(exportResult.sectionCounts).map(([s, c]) => `${c} ${s}`).join(", ")}
              </p>
            </div>
            <a
              href={exportResult.asanaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-nia-grey-blue hover:text-nia-dark flex-shrink-0"
            >
              View in Asana &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Sync error banner */}
      {syncError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-amber-700">{syncError}</span>
          <div className="flex items-center gap-2">
            {syncError.includes("Reconnect") && (
              <a href="/settings" className="text-xs font-medium text-nia-grey-blue hover:text-nia-dark">Reconnect Asana</a>
            )}
            <button onClick={() => setSyncError(null)} className="text-xs text-text-tertiary hover:text-foreground">Dismiss</button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-nia-red/10 border border-nia-red/20 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-nia-red">{error}</span>
          <button onClick={() => setError("")} className="text-xs text-text-tertiary hover:text-foreground">Dismiss</button>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-tertiary">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            {pendingCount > 0 && ` (${pendingCount} to review)`}
            <HelpTip text="Tasks from Asana, AI suggestions, and manual entries — all in one view." />
          </span>
          {/* Sync status */}
          {asanaProjectGid && (
            <div className="flex items-center gap-1.5">
              {lastSyncedAt && (
                <span className="text-xs text-text-muted">
                  Synced {formatSyncTime(lastSyncedAt)}
                </span>
              )}
              <button
                onClick={handleManualRefresh}
                disabled={syncing || refreshCooldown}
                className="text-text-muted hover:text-nia-grey-blue disabled:opacity-40 p-0.5 transition-colors"
                title={syncing ? "Syncing..." : refreshCooldown ? "Please wait..." : "Refresh from Asana"}
              >
                <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {unsyncedTasks.length > 0 && (
          <button
            onClick={handleExportToAsana}
            disabled={exporting}
            className="bg-nia-green text-white rounded-lg py-2 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {exporting ? "Syncing..." : `Sync ${unsyncedTasks.length} to Asana`}
          </button>
        )}
      </div>

      {/* ═══ AI SUGGESTIONS SECTION ═══ */}
      {pendingSuggestions.length > 0 && (
        <div className="bg-nia-orange/5 border border-nia-orange/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-nia-orange mb-3">
            AI Suggestions — {pendingSuggestions.length} to review
          </h3>
          <div className="space-y-2">
            {pendingSuggestions.map((task) => (
              <div
                key={task.id}
                className="bg-card border border-dashed border-nia-orange/30 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nia-dark">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: PDCA_SECTIONS[task.pdca_section].color + "20",
                          color: PDCA_SECTIONS[task.pdca_section].color,
                        }}
                      >
                        {PDCA_SECTIONS[task.pdca_section].label}
                      </span>
                      {task.source_detail && (
                        <span className="text-[10px] text-text-muted">From: {task.source_detail}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleKeep(task.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-nia-green/10 text-nia-green hover:bg-nia-green/20 transition-colors"
                      title="Keep"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDismiss(task.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-nia-red/10 text-nia-red hover:bg-nia-red/20 transition-colors"
                      title="Dismiss"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast for edit feedback */}
      {toastState && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onRetry={toastState.retry}
          onDismiss={() => setToastState(null)}
        />
      )}

      {/* ═══ TASK DETAIL PANEL ═══ */}
      {selectedTaskId && (() => {
        const selectedTask = tasks.find((t) => t.id === selectedTaskId);
        if (!selectedTask) return null;
        return (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
            onToggleComplete={handleToggleComplete}
            isToggling={togglingTaskIds.has(selectedTaskId)}
            savingField={savingField}
          />
        );
      })()}

      {/* ═══ TASK SECTIONS ═══ */}
      {sections.map((section) => {
        const pdca = section.pdcaMatch;
        const borderColor = pdca ? PDCA_SECTIONS[pdca].color : "var(--border)";

        return (
          <div key={section.key} className="bg-surface-hover rounded-xl overflow-visible">
            {/* Section header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: `3px solid ${borderColor}` }}
            >
              <h3 className="text-sm font-semibold" style={{ color: pdca ? PDCA_SECTIONS[pdca].color : undefined }}>
                {section.label}
                <span className="font-normal text-text-muted ml-2">
                  {section.completedCount}/{section.totalCount} complete
                </span>
              </h3>
            </div>

            {/* Task cards */}
            <div className="p-3 space-y-2">
              {section.tasks.map((task) => {
                // Find subtasks for this task
                const subtasks = task.asana_task_gid
                  ? allSubtasks.filter((s) => s.parent_asana_gid === task.asana_task_gid)
                  : [];

                return (
                  <div key={task.id}>
                    <UnifiedTaskCard
                      task={task}
                      onToggleComplete={handleToggleComplete}
                      isToggling={togglingTaskIds.has(task.id)}
                      onCardClick={(t) => setSelectedTaskId(t.id)}
                      onDueDateChange={(id, date) => handleUpdateTask(id, { due_date: date || null } as Partial<ProcessTask>)}
                    />
                    {/* Subtasks indented */}
                    {subtasks.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {sortTasks(subtasks).map((sub) => (
                          <UnifiedTaskCard
                            key={sub.id}
                            task={sub}
                            isSubtask
                            onToggleComplete={handleToggleComplete}
                            isToggling={togglingTaskIds.has(sub.id)}
                            onCardClick={(t) => setSelectedTaskId(t.id)}
                            onDueDateChange={(id, date) => handleUpdateTask(id, { due_date: date || null } as Partial<ProcessTask>)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Unified Task Card ────────────────────────────────────────

function UnifiedTaskCard({
  task,
  isSubtask,
  onToggleComplete,
  isToggling,
  onCardClick,
  onDueDateChange,
}: {
  task: ProcessTask;
  isSubtask?: boolean;
  onToggleComplete?: (taskId: number, currentCompleted: boolean) => void;
  isToggling?: boolean;
  onCardClick?: (task: ProcessTask) => void;
  onDueDateChange?: (taskId: number, date: string) => void;
}) {
  const overdue = isOverdue(task);
  const badge = ORIGIN_BADGE[task.origin] || ORIGIN_BADGE.hub_manual;

  return (
    <div
      onClick={() => onCardClick?.(task)}
      className={`bg-card rounded-lg border border-border-light transition-colors cursor-pointer ${
        task.completed ? "opacity-50" : "hover:border-border hover:shadow-sm"
      } ${isSubtask ? "p-2" : "p-3"}`}
    >
      <div className="flex items-start gap-2">
        {/* Completion toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.(task.id, task.completed);
          }}
          disabled={isToggling || task.status === "pending"}
          className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.completed
              ? "border-nia-green bg-nia-green"
              : "border-border hover:border-nia-green/50"
          } ${task.status === "pending" ? "opacity-30 cursor-default" : "cursor-pointer"}`}
          title={task.status === "pending" ? "Review this suggestion first" : task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {isToggling ? (
            <svg className="w-2.5 h-2.5 text-text-muted animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : task.completed ? (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-medium leading-snug ${
              isSubtask ? "text-xs" : "text-sm"
            } ${task.completed ? "line-through text-text-tertiary" : "text-nia-dark"}`}>
              {task.title}
            </p>

            {/* External link for Asana tasks */}
            {task.asana_task_url && (
              <a
                href={task.asana_task_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-text-muted hover:text-nia-grey-blue flex-shrink-0 p-0.5"
                title="Open in Asana"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Meta row: assignee, due date, origin badge */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Assignee */}
            <span className={`text-[10px] ${task.assignee_name ? "text-text-secondary" : "text-text-muted"}`}>
              {task.assignee_name || "Unassigned"}
            </span>

            {/* Inline due date (click to edit) */}
            <label
              onClick={(e) => e.stopPropagation()}
              className={`relative text-[10px] cursor-pointer hover:underline inline-flex items-center ${
                overdue ? "text-red-600 font-medium" : task.due_date ? "text-text-muted" : "text-text-muted/50"
              }`}
            >
              {task.due_date
                ? `${overdue ? "Overdue: " : ""}${formatDueDate(task.due_date)}`
                : "Add due date"}
              <input
                type="date"
                value={task.due_date || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onDueDateChange?.(task.id, e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                tabIndex={-1}
              />
            </label>

            {/* Origin badge */}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
