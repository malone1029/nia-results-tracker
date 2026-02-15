"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ProcessTask, TaskPriority, TaskComment, TaskActivity } from "@/lib/types";
import { PDCA_SECTIONS } from "@/lib/pdca";
import AssigneePicker from "@/components/assignee-picker";

interface DependencyItem {
  dependency_id: number;
  task_id: number;
  title: string;
  completed: boolean;
}

// Origin badge styles (same as task-review-panel)
const ORIGIN_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  asana:      { label: "Asana",         bg: "bg-nia-grey-blue/15", text: "text-nia-grey-blue" },
  hub_ai:     { label: "AI Suggestion", bg: "bg-nia-orange/15",    text: "text-nia-orange" },
  hub_manual: { label: "Manual",        bg: "bg-surface-muted",    text: "text-text-muted" },
};

interface TaskDetailPanelProps {
  task: ProcessTask;
  onClose: () => void;
  onUpdate: (taskId: number, fields: Partial<ProcessTask>) => void;
  onDelete: (taskId: number) => void;
  onToggleComplete: (taskId: number, currentCompleted: boolean) => void;
  isToggling?: boolean;
  savingField?: string | null;
  allTasks?: ProcessTask[];
}

export default function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
  onToggleComplete,
  isToggling,
  savingField,
  allTasks,
}: TaskDetailPanelProps) {
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Comments state
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Activity state
  const [activities, setActivities] = useState<TaskActivity[]>([]);

  // Dependencies state
  const [blockedBy, setBlockedBy] = useState<DependencyItem[]>([]);
  const [blocking, setBlocking] = useState<DependencyItem[]>([]);
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch] = useState("");
  const [addingDep, setAddingDep] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  // Sync local state when task prop changes (e.g. after optimistic revert)
  useEffect(() => {
    setEditedTitle(task.title);
    setEditedDescription(task.description || "");
  }, [task.title, task.description]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch comments + activity + dependencies on open
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (isMountedRef.current) setComments(data); })
      .catch(() => {});
    fetch(`/api/tasks/${task.id}/activity`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (isMountedRef.current) setActivities(data); })
      .catch(() => {});
    fetch(`/api/tasks/${task.id}/dependencies`)
      .then((r) => r.ok ? r.json() : { blockedBy: [], blocking: [] })
      .then((data) => {
        if (isMountedRef.current) {
          setBlockedBy(data.blockedBy || []);
          setBlocking(data.blocking || []);
        }
      })
      .catch(() => {});
  }, [task.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
    };
  }, []);

  // ── Title save (on blur or Enter) ──
  const handleTitleSave = useCallback(() => {
    const trimmed = editedTitle.trim();
    if (!trimmed) {
      // Don't allow empty title — revert
      setEditedTitle(task.title);
      return;
    }
    if (trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed } as Partial<ProcessTask>);
    }
  }, [editedTitle, task.title, task.id, onUpdate]);

  // ── Description save (debounced 500ms) ──
  function handleDescriptionChange(value: string) {
    setEditedDescription(value);
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && value !== (task.description || "")) {
        onUpdate(task.id, { description: value || null } as Partial<ProcessTask>);
      }
    }, 500);
  }

  // ── Start date save (immediate) ──
  function handleStartDateChange(value: string) {
    onUpdate(task.id, { start_date: value || null } as Partial<ProcessTask>);
  }

  // ── Due date save (immediate) ──
  function handleDueDateChange(value: string) {
    onUpdate(task.id, { due_date: value || null } as Partial<ProcessTask>);
  }

  // ── Add dependency ──
  async function handleAddDependency(dependsOnTaskId: number) {
    setAddingDep(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depends_on_task_id: dependsOnTaskId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add dependency");
      }
      // Refresh dependencies
      const depsRes = await fetch(`/api/tasks/${task.id}/dependencies`);
      if (depsRes.ok) {
        const data = await depsRes.json();
        setBlockedBy(data.blockedBy || []);
        setBlocking(data.blocking || []);
      }
      setShowDepPicker(false);
      setDepSearch("");
    } catch {
      // Error handled silently for now
    } finally {
      setAddingDep(false);
    }
  }

  // ── Remove dependency ──
  async function handleRemoveDependency(dependencyId: number) {
    // Optimistic remove
    setBlockedBy((prev) => prev.filter((d) => d.dependency_id !== dependencyId));
    setBlocking((prev) => prev.filter((d) => d.dependency_id !== dependencyId));

    try {
      const res = await fetch(`/api/tasks/${task.id}/dependencies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependency_id: dependencyId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Refresh on error to revert
      fetch(`/api/tasks/${task.id}/dependencies`)
        .then((r) => r.ok ? r.json() : { blockedBy: [], blocking: [] })
        .then((data) => {
          setBlockedBy(data.blockedBy || []);
          setBlocking(data.blocking || []);
        });
    }
  }

  // ── Delete ──
  function handleDelete() {
    onDelete(task.id);
  }

  // ── Post comment ──
  async function handlePostComment() {
    const trimmed = commentBody.trim();
    if (!trimmed || postingComment) return;

    setPostingComment(true);
    // Optimistic add
    const tempComment: TaskComment = {
      id: -Date.now(),
      task_id: task.id,
      user_id: "",
      user_name: "You",
      body: trimmed,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, tempComment]);
    setCommentBody("");

    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      const real = await res.json();
      // Replace temp with real
      setComments((prev) => prev.map((c) => (c.id === tempComment.id ? real : c)));
    } catch {
      // Revert
      setComments((prev) => prev.filter((c) => c.id !== tempComment.id));
      setCommentBody(trimmed);
    } finally {
      setPostingComment(false);
    }
  }

  // ── Format activity entry ──
  function formatActivity(a: TaskActivity): string {
    const name = a.user_name.split(" ")[0]; // First name only
    switch (a.action) {
      case "created": return `${name} created this task`;
      case "completed": return `${name} marked complete`;
      case "uncompleted": return `${name} marked incomplete`;
      case "deleted": return `${name} deleted this task`;
      case "commented": return `${name} commented`;
      case "reassigned": {
        const d = a.detail as { from?: string; to?: string } | null;
        return `${name} reassigned from ${d?.from || "?"} to ${d?.to || "?"}`;
      }
      case "priority_changed": {
        const d = a.detail as { from?: string; to?: string } | null;
        return `${name} changed priority from ${d?.from || "?"} to ${d?.to || "?"}`;
      }
      case "status_changed": return `${name} changed status`;
      case "dependency_added": {
        const d = a.detail as { depends_on_title?: string } | null;
        return `${name} added dependency on "${d?.depends_on_title || "a task"}"`;
      }
      case "dependency_removed": return `${name} removed a dependency`;
      default: return `${name} updated task`;
    }
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const badge = ORIGIN_BADGE[task.origin] || ORIGIN_BADGE.hub_manual;
  const isAsana = task.origin === "asana";
  const pdca = task.pdca_section ? PDCA_SECTIONS[task.pdca_section] : null;

  return (
    <>
      {/* Backdrop — z-[55] to cover the Ask AI floating button (z-50) */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[55]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-0 sm:left-auto sm:right-0 sm:top-0 h-full w-full sm:w-[420px] bg-card shadow-2xl z-[60] animate-slide-in-right flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          {/* Completion toggle */}
          <button
            type="button"
            onClick={() => onToggleComplete(task.id, task.completed)}
            disabled={isToggling || task.status === "pending"}
            className={`flex-shrink-0 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              task.completed
                ? "border-nia-green bg-nia-green"
                : "border-border hover:border-nia-green/50"
            } ${task.status === "pending" ? "opacity-30 cursor-default" : "cursor-pointer"}`}
          >
            {isToggling ? (
              <svg className="w-3 h-3 text-text-muted animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : task.completed ? (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </button>

          {/* Title input */}
          <div className="flex-1 min-w-0">
            <input
              ref={titleRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={`w-full text-base font-semibold bg-transparent border-none outline-none focus:ring-0 p-0 ${
                task.completed ? "line-through text-text-tertiary" : "text-nia-dark"
              }`}
            />
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
              {savingField && (
                <span className="text-[10px] text-text-muted animate-pulse">Saving...</span>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Details section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Details</h4>

            {/* Start date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Start date</span>
              <input
                type="date"
                value={task.start_date || ""}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-sm bg-transparent border border-border-light rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-nia-grey-blue"
              />
            </div>

            {/* Due date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Due date</span>
              <input
                type="date"
                value={task.due_date || ""}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="text-sm bg-transparent border border-border-light rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-nia-grey-blue"
              />
            </div>

            {/* Date progress bar (when both start and due are set) */}
            {task.start_date && task.due_date && !task.completed && (() => {
              const start = new Date(task.start_date + "T00:00:00").getTime();
              const end = new Date(task.due_date + "T00:00:00").getTime();
              const now = Date.now();
              const total = end - start;
              const elapsed = now - start;
              const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
              const overdue = now > end;

              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>{pct}% of time elapsed</span>
                    {overdue && <span className="text-red-600 font-medium">Overdue</span>}
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overdue ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-nia-green"
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* PDCA section */}
            {pdca && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Section</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: pdca.color + "20",
                    color: pdca.color,
                  }}
                >
                  {pdca.label}
                </span>
              </div>
            )}

            {/* Priority */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Priority</span>
              <div className="flex gap-1">
                {(["high", "medium", "low"] as TaskPriority[]).map((level) => {
                  const isSelected = (task.priority || "medium") === level;
                  const styles: Record<TaskPriority, { bg: string; text: string; ring: string }> = {
                    high:   { bg: "bg-red-500/15",        text: "text-red-600",       ring: "ring-red-500" },
                    medium: { bg: "bg-nia-orange/15",     text: "text-nia-orange",    ring: "ring-nia-orange" },
                    low:    { bg: "bg-surface-muted",     text: "text-text-muted",    ring: "ring-border" },
                  };
                  const s = styles[level];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onUpdate(task.id, { priority: level } as Partial<ProcessTask>)}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize transition-all ${s.bg} ${s.text} ${
                        isSelected ? `ring-2 ${s.ring} ring-offset-1` : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Status</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                task.completed
                  ? "bg-nia-green/15 text-nia-green"
                  : task.status === "pending"
                  ? "bg-nia-orange/15 text-nia-orange"
                  : "bg-nia-grey-blue/15 text-nia-grey-blue"
              }`}>
                {task.completed ? "Completed" : task.status === "pending" ? "Pending review" : "Active"}
              </span>
            </div>

            {/* Assignee */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Assignee</span>
              <AssigneePicker
                currentAssigneeName={task.assignee_name}
                currentAssigneeGid={task.assignee_asana_gid}
                isSaving={savingField === "assignee_name"}
                onSelect={(member) => {
                  if (member) {
                    onUpdate(task.id, {
                      assignee_name: member.name,
                      assignee_email: member.email,
                      assignee_asana_gid: member.gid,
                    } as Partial<ProcessTask>);
                  } else {
                    onUpdate(task.id, {
                      assignee_name: null,
                      assignee_email: null,
                      assignee_asana_gid: null,
                    } as Partial<ProcessTask>);
                  }
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Description</h4>
            <textarea
              value={editedDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Add a description..."
              rows={4}
              className="w-full text-sm bg-surface-hover border border-border-light rounded-lg px-3 py-2 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue resize-none"
            />
          </div>

          {/* Dependencies */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Dependencies</h4>

            {/* Blocked by list */}
            {blockedBy.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted font-medium">Blocked by</span>
                {blockedBy.map((dep) => (
                  <div key={dep.dependency_id} className="flex items-center gap-2 bg-surface-hover rounded-lg px-2.5 py-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.completed ? "bg-nia-green" : "bg-red-500"}`} />
                    <span className={`text-xs flex-1 min-w-0 truncate ${dep.completed ? "line-through text-text-muted" : "text-nia-dark"}`}>
                      {dep.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDependency(dep.dependency_id)}
                      className="text-text-muted hover:text-nia-red p-0.5 transition-colors flex-shrink-0"
                      title="Remove dependency"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Blocking list */}
            {blocking.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted font-medium">Blocking</span>
                {blocking.map((dep) => (
                  <div key={dep.dependency_id} className="flex items-center gap-2 bg-surface-hover rounded-lg px-2.5 py-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.completed ? "bg-nia-green" : "bg-amber-500"}`} />
                    <span className={`text-xs flex-1 min-w-0 truncate ${dep.completed ? "line-through text-text-muted" : "text-nia-dark"}`}>
                      {dep.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDependency(dep.dependency_id)}
                      className="text-text-muted hover:text-nia-red p-0.5 transition-colors flex-shrink-0"
                      title="Remove dependency"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add dependency */}
            {showDepPicker ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={depSearch}
                  onChange={(e) => setDepSearch(e.target.value)}
                  placeholder="Search tasks in this process..."
                  autoFocus
                  className="w-full text-xs bg-surface-hover border border-border-light rounded-lg px-3 py-1.5 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
                />
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {(allTasks || [])
                    .filter(
                      (t) =>
                        t.id !== task.id &&
                        t.process_id === task.process_id &&
                        !t.is_subtask &&
                        !blockedBy.some((d) => d.task_id === t.id) &&
                        (!depSearch || t.title.toLowerCase().includes(depSearch.toLowerCase()))
                    )
                    .slice(0, 8)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleAddDependency(t.id)}
                        disabled={addingDep}
                        className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-surface-hover/80 text-nia-dark transition-colors disabled:opacity-50 truncate"
                      >
                        {t.title}
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setShowDepPicker(false); setDepSearch(""); }}
                  className="text-[10px] text-text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDepPicker(true)}
                className="text-xs text-nia-grey-blue hover:text-nia-dark transition-colors inline-flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Link dependency
              </button>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Comments {comments.length > 0 && `(${comments.length})`}
            </h4>
            {comments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="bg-surface-hover rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-nia-dark">{c.user_name}</span>
                      <span className="text-[10px] text-text-muted">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-xs text-text-secondary whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                placeholder="Add a comment..."
                maxLength={2000}
                className="flex-1 text-xs bg-surface-hover border border-border-light rounded-lg px-3 py-1.5 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
              />
              <button
                onClick={handlePostComment}
                disabled={!commentBody.trim() || postingComment}
                className="text-xs font-medium text-nia-grey-blue hover:text-nia-dark disabled:opacity-40 transition-colors px-2"
              >
                Send
              </button>
            </div>
          </div>

          {/* Activity */}
          {activities.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Activity</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-border mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-text-secondary">{formatActivity(a)}</p>
                      <p className="text-[10px] text-text-muted">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata (read-only) */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Info</h4>
            <div className="text-xs text-text-muted space-y-1">
              <p>Created: {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              {task.last_synced_at && (
                <p>Last synced: {new Date(task.last_synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              )}
              {task.asana_section_name && <p>Asana section: {task.asana_section_name}</p>}
              <p>Source: {badge.label}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          {/* Asana link (if applicable) */}
          {task.asana_task_url ? (
            <a
              href={task.asana_task_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-nia-grey-blue hover:text-nia-dark flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Asana
            </a>
          ) : (
            <div /> // Spacer
          )}

          {/* Delete button — all tasks */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                {task.asana_task_gid
                  ? "Delete this task? This will also delete it from Asana."
                  : "Delete this task?"}
              </span>
              <button
                onClick={handleDelete}
                className="text-xs font-medium text-nia-red hover:text-red-700 transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs font-medium text-text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-text-muted hover:text-nia-red flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </>
  );
}
