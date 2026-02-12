"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PDCA_SECTIONS } from "@/lib/pdca";
import type { PdcaSection, ProcessTask } from "@/lib/types";

const COLUMNS: PdcaSection[] = ["plan", "execute", "evaluate", "improve"];

interface TaskReviewPanelProps {
  processId: number;
  onTaskCountChange?: (count: number) => void;
}

export default function TaskReviewPanel({ processId, onTaskCountChange }: TaskReviewPanelProps) {
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ exported: number; failed: number; sectionCounts: Record<string, number>; asanaUrl: string; errors?: string[] } | null>(null);
  const [error, setError] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?processId=${processId}`);
      if (res.ok) {
        const data: ProcessTask[] = await res.json();
        setTasks(data);
        onTaskCountChange?.(data.filter((t) => t.status === "pending").length);
      }
    } catch {
      setError("Failed to load tasks");
    }
    setLoading(false);
  }, [processId, onTaskCountChange]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function handleDelete(taskId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
      if (!res.ok) { setError("Failed to delete task"); return; }
      const updatedTasks = tasks.filter((t) => t.id !== taskId);
      setTasks(updatedTasks);
      setDeletingId(null);
      onTaskCountChange?.(updatedTasks.filter((t) => t.status === "pending").length);
    } catch {
      setError("Failed to delete task");
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(taskId: number, newSection: PdcaSection) {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, pdca_section: newSection }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, pdca_section: newSection } : t))
        );
      }
    } catch {
      setError("Failed to move task");
    }
  }

  function startEdit(task: ProcessTask) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
  }

  async function saveEdit(taskId: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
        }),
      });
      if (!res.ok) { setError("Failed to save changes"); return; }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, title: editTitle.trim(), description: editDescription.trim() || null }
            : t
        )
      );
      setEditingId(null);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

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
          setError(data.message || "Process not linked to Asana. Use the export dialog on the Content tab first.");
        } else if (data.error === "not_connected") {
          setError(data.message || "Asana not connected. Go to Settings to connect.");
        } else {
          setError(data.error || "Export failed");
        }
        return;
      }
      setExportResult(data);
      // Refresh tasks to show updated statuses
      fetchTasks();
    } catch {
      setError("Export to Asana failed");
    } finally {
      setExporting(false);
    }
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const exportedTasks = tasks.filter((t) => t.status === "exported");

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col} className="bg-surface-hover rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-surface-muted rounded w-20 mb-4" />
            <div className="space-y-3">
              <div className="h-16 bg-surface-muted rounded" />
              <div className="h-16 bg-surface-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-nia-dark mb-1">No tasks queued</h3>
        <p className="text-sm text-text-tertiary max-w-sm">
          Use the AI coach to generate improvement tasks. Each suggestion creates actionable tasks mapped to Plan, Execute, Evaluate, and Improve sections.
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
                Exported {exportResult.exported} task{exportResult.exported !== 1 ? "s" : ""} to Asana
                {exportResult.failed > 0 && ` (${exportResult.failed} failed)`}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {Object.entries(exportResult.sectionCounts).map(([section, count]) => `${count} ${section}`).join(", ")}
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
          {exportResult.failed > 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
              <p className="font-medium">Export errors ({exportResult.failed} tasks failed):</p>
              {exportResult.errors && exportResult.errors.length > 0 ? (
                <p className="mt-1">{[...new Set(exportResult.errors)].join("; ")}</p>
              ) : (
                <p className="mt-1">No error details available.</p>
              )}
            </div>
          )}
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-tertiary">
            {pendingTasks.length} pending{exportedTasks.length > 0 ? `, ${exportedTasks.length} exported` : ""}
          </span>
          <div className="flex gap-1.5">
            {COLUMNS.map((col) => {
              const count = pendingTasks.filter((t) => t.pdca_section === col).length;
              if (count === 0) return null;
              return (
                <span
                  key={col}
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: PDCA_SECTIONS[col].color + "20",
                    color: PDCA_SECTIONS[col].color,
                  }}
                >
                  {count} {PDCA_SECTIONS[col].label}
                </span>
              );
            })}
          </div>
        </div>
        {pendingTasks.length > 0 && (
          <button
            onClick={handleExportToAsana}
            disabled={exporting}
            className="bg-nia-green text-white rounded-lg py-2 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {exporting ? "Exporting..." : `Export ${pendingTasks.length} to Asana`}
          </button>
        )}
      </div>

      {/* PDCA columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const sectionMeta = PDCA_SECTIONS[col];
          const columnTasks = tasks.filter((t) => t.pdca_section === col);
          const pending = columnTasks.filter((t) => t.status === "pending");
          const exported = columnTasks.filter((t) => t.status === "exported");

          return (
            <div key={col} className="bg-surface-hover rounded-xl overflow-hidden">
              {/* Column header */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: `3px solid ${sectionMeta.color}` }}
              >
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: sectionMeta.color }}>
                    {sectionMeta.label}
                  </h3>
                  <p className="text-xs text-text-muted">{sectionMeta.description}</p>
                </div>
                {columnTasks.length > 0 && (
                  <span
                    className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: sectionMeta.color + "20", color: sectionMeta.color }}
                  >
                    {columnTasks.length}
                  </span>
                )}
              </div>

              {/* Task list */}
              <div className="p-3 space-y-2 min-h-[80px]">
                {pending.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isEditing={editingId === task.id}
                    editTitle={editTitle}
                    editDescription={editDescription}
                    onEditTitleChange={setEditTitle}
                    onEditDescriptionChange={setEditDescription}
                    onStartEdit={() => startEdit(task)}
                    onSaveEdit={() => saveEdit(task.id)}
                    onCancelEdit={() => setEditingId(null)}
                    isDeleting={deletingId === task.id}
                    onStartDelete={() => setDeletingId(task.id)}
                    onConfirmDelete={() => handleDelete(task.id)}
                    onCancelDelete={() => setDeletingId(null)}
                    onMove={(newSection) => handleMove(task.id, newSection)}
                    currentSection={col}
                    isBusy={saving}
                  />
                ))}

                {/* Exported tasks (greyed out) */}
                {exported.map((task) => (
                  <div
                    key={task.id}
                    className="bg-card/50 rounded-lg p-2.5 border border-border-light opacity-60"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs text-text-tertiary line-through">{task.title}</span>
                      {task.asana_task_url && (
                        <a
                          href={task.asana_task_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nia-grey-blue hover:text-nia-dark flex-shrink-0"
                          title="View in Asana"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="18" r="4" />
                            <circle cx="5" cy="8" r="4" />
                            <circle cx="19" cy="8" r="4" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted">Exported</span>
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <p className="text-xs text-text-muted italic text-center py-4">
                    No tasks yet
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────

interface TaskCardProps {
  task: ProcessTask;
  isEditing: boolean;
  editTitle: string;
  editDescription: string;
  onEditTitleChange: (v: string) => void;
  onEditDescriptionChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  isDeleting: boolean;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onMove: (section: PdcaSection) => void;
  currentSection: PdcaSection;
  isBusy: boolean;
}

function TaskCard({
  task,
  isEditing,
  editTitle,
  editDescription,
  onEditTitleChange,
  onEditDescriptionChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isDeleting,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
  onMove,
  currentSection,
  isBusy,
}: TaskCardProps) {
  const otherSections = COLUMNS.filter((c) => c !== currentSection);

  // Keyboard shortcut: Escape to cancel editing
  useEffect(() => {
    if (!isEditing) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelEdit();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, onCancelEdit]);

  if (isEditing) {
    return (
      <div className="bg-card rounded-xl p-3 border-2 border-nia-grey-blue/40 shadow-lg shadow-nia-grey-blue/10 space-y-2.5 -mx-1">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1 block">Title</label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            className="w-full text-sm font-medium text-nia-dark border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 focus:border-nia-grey-blue/40"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1 block">Description</label>
          <AutoGrowTextarea
            value={editDescription}
            onChange={onEditDescriptionChange}
            placeholder="Add details, acceptance criteria, or notes..."
            minRows={3}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSaveEdit}
            disabled={!editTitle.trim() || isBusy}
            className="text-xs font-medium text-white bg-nia-dark-solid rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isBusy ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onCancelEdit}
            className="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1.5"
          >
            Cancel
          </button>
          <span className="text-[10px] text-text-muted ml-auto">Esc to cancel</span>
        </div>
      </div>
    );
  }

  if (isDeleting) {
    return (
      <div className="bg-nia-red/10 rounded-lg p-2.5 border border-nia-red/20">
        <p className="text-xs text-nia-red mb-2">Delete this task?</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirmDelete}
            disabled={isBusy}
            className="text-xs font-medium text-white bg-nia-red rounded px-2.5 py-1 hover:opacity-80 disabled:opacity-50"
          >
            {isBusy ? "Deleting..." : "Delete"}
          </button>
          <button
            onClick={onCancelDelete}
            className="text-xs text-text-tertiary hover:text-text-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-lg p-2.5 border border-border-light hover:border-border transition-colors group cursor-pointer"
      onClick={onStartEdit}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-medium text-nia-dark leading-snug">{task.title}</span>
        {/* Actions — visible on hover (desktop), always tappable via card click (mobile) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            className="text-text-muted hover:text-nia-grey-blue p-0.5"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStartDelete(); }}
            className="text-text-muted hover:text-red-500 p-0.5"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{task.description}</p>
      )}

      {/* Badges row */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {task.adli_dimension && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-nia-grey-blue/10 text-nia-grey-blue capitalize">
            {task.adli_dimension}
          </span>
        )}
        <span className="text-[10px] text-text-muted">
          {task.source === "ai_suggestion" ? "AI" : task.source === "ai_interview" ? "Interview" : "Manual"}
        </span>

        {/* Move dropdown */}
        <div className="ml-auto relative">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value as PdcaSection);
            }}
            className="text-[10px] text-text-muted bg-transparent border-none cursor-pointer hover:text-nia-grey-blue focus:outline-none appearance-none pr-3"
            title="Move to section"
            style={{ backgroundImage: "none" }}
          >
            <option value="">Move...</option>
            {otherSections.map((s) => (
              <option key={s} value={s}>
                {PDCA_SECTIONS[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Auto-growing Textarea ──────────────────────────────────

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const minHeight = minRows * 20 + 16; // ~20px per line + padding
    el.style.height = Math.max(el.scrollHeight, minHeight) + "px";
  }, [value, minRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full text-sm text-text-secondary border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 focus:border-nia-grey-blue/40 resize-y leading-relaxed"
    />
  );
}
