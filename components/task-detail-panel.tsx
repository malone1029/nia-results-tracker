"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ProcessTask, TaskPriority, TaskComment, TaskActivity, TaskAttachment, RecurrenceRule } from "@/lib/types";
import { PDCA_SECTIONS } from "@/lib/pdca";
import { describeRecurrence } from "@/lib/recurrence";
import AssigneePicker from "@/components/assignee-picker";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  // @mention autocomplete state
  const [members, setMembers] = useState<{ name: string; email: string; gid: string }[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Activity state
  const [activities, setActivities] = useState<TaskActivity[]>([]);

  // Dependencies state
  const [blockedBy, setBlockedBy] = useState<DependencyItem[]>([]);
  const [blocking, setBlocking] = useState<DependencyItem[]>([]);
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch] = useState("");
  const [addingDep, setAddingDep] = useState(false);

  // Recurrence state
  const [showRecurrenceEditor, setShowRecurrenceEditor] = useState(false);
  const [recType, setRecType] = useState<RecurrenceRule["type"]>("weekly");
  const [recInterval, setRecInterval] = useState(1);
  const [recDayOfWeek, setRecDayOfWeek] = useState(1);
  const [recDayOfMonth, setRecDayOfMonth] = useState(1);

  // Attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fetch(`/api/tasks/${task.id}/attachments`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (isMountedRef.current) setAttachments(data); })
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

  // ── Fetch workspace members (once, for @mention autocomplete) ──
  useEffect(() => {
    fetch("/api/asana/workspace-members")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (isMountedRef.current && Array.isArray(data)) {
          setMembers(data);
        }
      })
      .catch(() => {});
  }, []);

  // ── @mention input handler ──
  function handleCommentInput(value: string) {
    setCommentBody(value);
    const input = commentInputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || value.length;

    // Find if we're mid-mention: look backwards from cursor for "@"
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([A-Za-z ]*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1].toLowerCase());
      setMentionCursorPos(cursorPos);
      setShowMentionDropdown(true);
      setMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
    }
  }

  // ── Insert mention into comment ──
  function insertMention(memberName: string) {
    const textBeforeCursor = commentBody.slice(0, mentionCursorPos);
    const atPos = textBeforeCursor.lastIndexOf("@");
    const before = commentBody.slice(0, atPos);
    const after = commentBody.slice(mentionCursorPos);
    const newValue = `${before}@${memberName} ${after}`;
    setCommentBody(newValue);
    setShowMentionDropdown(false);
    setMentionSearch("");
    // Re-focus input
    setTimeout(() => commentInputRef.current?.focus(), 0);
  }

  // Filtered members for dropdown
  const filteredMembers = members.filter(
    (m) => m.name && m.name.toLowerCase().includes(mentionSearch)
  ).slice(0, 5);

  // ── Mention keyboard navigation ──
  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    // Default Enter → send comment
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePostComment();
    }
  }

  // ── Save recurrence rule ──
  async function handleSaveRecurrence() {
    const rule: RecurrenceRule = {
      type: recType,
      interval: recInterval,
      ...(recType === "weekly" ? { dayOfWeek: recDayOfWeek } : {}),
      ...(recType === "monthly" ? { dayOfMonth: recDayOfMonth } : {}),
    };
    onUpdate(task.id, { recurrence_rule: rule } as Partial<ProcessTask>);
    setShowRecurrenceEditor(false);
  }

  function handleRemoveRecurrence() {
    onUpdate(task.id, { recurrence_rule: null } as Partial<ProcessTask>);
    setShowRecurrenceEditor(false);
  }

  // ── Upload attachment ──
  async function handleUploadAttachment(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const attachment = await res.json();
      setAttachments((prev) => [...prev, attachment]);
    } catch {
      // Error silently for now
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Delete attachment ──
  async function handleDeleteAttachment(attachmentId: number) {
    // Optimistic remove
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));

    try {
      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachment_id: attachmentId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Refresh on error
      fetch(`/api/tasks/${task.id}/attachments`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setAttachments(data));
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "🖼";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word")) return "📝";
    return "📎";
  }

  // ── Render comment body with @mention highlights ──
  function renderCommentBody(text: string) {
    const parts = text.split(/(@[A-Za-z]+ [A-Za-z]+)/g);
    return parts.map((part, i) => {
      if (part.match(/^@[A-Za-z]+ [A-Za-z]+$/)) {
        return (
          <span key={i} className="text-nia-grey-blue font-medium bg-nia-grey-blue/10 rounded px-0.5">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
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
      case "attachment_added": {
        const d = a.detail as { file_name?: string } | null;
        return `${name} added "${d?.file_name || "a file"}"`;
      }
      case "attachment_removed": {
        const d = a.detail as { file_name?: string } | null;
        return `${name} removed "${d?.file_name || "a file"}"`;
      }
      case "recurrence_set": {
        const d = a.detail as { removed?: boolean } | null;
        return d?.removed ? `${name} removed recurrence` : `${name} set recurrence`;
      }
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

          {/* Recurrence */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Recurrence</h4>

            {showRecurrenceEditor ? (
              <div className="space-y-2 bg-surface-hover rounded-lg p-3">
                {/* Type chips */}
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRecType(type)}
                      className={`text-xs font-medium px-3 py-1 rounded-lg capitalize transition-all ${
                        recType === type
                          ? "bg-nia-grey-blue text-white"
                          : "bg-card text-text-secondary hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Interval */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={recInterval}
                    onChange={(e) => setRecInterval(Math.max(1, Number(e.target.value)))}
                    className="w-14 text-xs text-center bg-card border border-border-light rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-nia-grey-blue"
                  />
                  <span className="text-xs text-text-secondary">
                    {recType === "daily" ? "day(s)" : recType === "weekly" ? "week(s)" : "month(s)"}
                  </span>
                </div>

                {/* Day of week for weekly */}
                {recType === "weekly" && (
                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setRecDayOfWeek(idx)}
                        className={`text-[10px] font-medium w-8 h-6 rounded transition-all ${
                          recDayOfWeek === idx
                            ? "bg-nia-grey-blue text-white"
                            : "bg-card text-text-muted hover:text-foreground"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}

                {/* Day of month for monthly */}
                {recType === "monthly" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">On day</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={recDayOfMonth}
                      onChange={(e) => setRecDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
                      className="w-14 text-xs text-center bg-card border border-border-light rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-nia-grey-blue"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveRecurrence}
                    className="text-xs font-medium text-nia-grey-blue hover:text-nia-dark transition-colors"
                  >
                    Save
                  </button>
                  {task.recurrence_rule && (
                    <button
                      type="button"
                      onClick={handleRemoveRecurrence}
                      className="text-xs font-medium text-nia-red hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRecurrenceEditor(false)}
                    className="text-xs text-text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : task.recurrence_rule ? (
              <div className="flex items-center justify-between bg-surface-hover rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-nia-grey-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-xs text-nia-dark">{describeRecurrence(task.recurrence_rule)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Pre-fill editor with current values
                    setRecType(task.recurrence_rule!.type);
                    setRecInterval(task.recurrence_rule!.interval);
                    if (task.recurrence_rule!.dayOfWeek !== undefined) setRecDayOfWeek(task.recurrence_rule!.dayOfWeek);
                    if (task.recurrence_rule!.dayOfMonth !== undefined) setRecDayOfMonth(task.recurrence_rule!.dayOfMonth);
                    setShowRecurrenceEditor(true);
                  }}
                  className="text-[10px] text-nia-grey-blue hover:text-nia-dark transition-colors"
                >
                  Edit
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRecurrenceEditor(true)}
                className="text-xs text-nia-grey-blue hover:text-nia-dark transition-colors inline-flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Set up recurrence
              </button>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Attachments {attachments.length > 0 && `(${attachments.length})`}
            </h4>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 bg-surface-hover rounded-lg px-2.5 py-1.5">
                    <span className="text-sm flex-shrink-0">{getFileIcon(att.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      {att.url ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-nia-grey-blue hover:underline truncate block"
                        >
                          {att.file_name}
                        </a>
                      ) : (
                        <span className="text-xs text-nia-dark truncate block">{att.file_name}</span>
                      )}
                      <span className="text-[10px] text-text-muted">{formatFileSize(att.file_size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-text-muted hover:text-nia-red p-0.5 transition-colors flex-shrink-0"
                      title="Remove attachment"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed border-border-light rounded-lg p-3 text-center cursor-pointer hover:border-nia-grey-blue transition-colors ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <p className="text-xs text-text-muted">
                {uploading ? "Uploading..." : "Click to upload a file"}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                Images, PDF, Word, text (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAttachment(file);
                }}
              />
            </div>
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
                    <p className="text-xs text-text-secondary whitespace-pre-wrap">{renderCommentBody(c.body)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentBody}
                  onChange={(e) => handleCommentInput(e.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Add a comment... (@ to mention)"
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

              {/* @mention dropdown */}
              {showMentionDropdown && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                  {filteredMembers.map((m, idx) => (
                    <button
                      key={m.gid}
                      type="button"
                      onClick={() => insertMention(m.name)}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        idx === mentionIndex
                          ? "bg-nia-grey-blue/10 text-nia-dark"
                          : "text-text-secondary hover:bg-surface-hover"
                      }`}
                    >
                      <span className="font-medium">{m.name}</span>
                      {m.email && (
                        <span className="ml-2 text-text-muted">{m.email}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
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
