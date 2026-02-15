"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ProcessTask } from "@/lib/types";
import { PDCA_SECTIONS } from "@/lib/pdca";

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
}

export default function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
  onToggleComplete,
  isToggling,
  savingField,
}: TaskDetailPanelProps) {
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Cleanup description timer
  useEffect(() => {
    return () => {
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
      if (value !== (task.description || "")) {
        onUpdate(task.id, { description: value || null } as Partial<ProcessTask>);
      }
    }, 500);
  }

  // ── Due date save (immediate) ──
  function handleDueDateChange(value: string) {
    onUpdate(task.id, { due_date: value || null } as Partial<ProcessTask>);
  }

  // ── Delete ──
  function handleDelete() {
    onDelete(task.id);
  }

  const badge = ORIGIN_BADGE[task.origin] || ORIGIN_BADGE.hub_manual;
  const isAsana = task.origin === "asana";
  const pdca = task.pdca_section ? PDCA_SECTIONS[task.pdca_section] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-card shadow-2xl z-50 animate-slide-in-right flex flex-col"
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

            {/* Assignee (read-only for now — PR 3 will add picker) */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Assignee</span>
              <span className="text-sm text-foreground">
                {task.assignee_name || "Unassigned"}
              </span>
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
          {isAsana && task.asana_task_url ? (
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

          {/* Delete button — Hub tasks only (not Asana-origin) */}
          {!isAsana && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Delete this task?</span>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
