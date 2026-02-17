"use client";

import type { ProcessTask } from "@/lib/types";

// Origin badge colors
export const ORIGIN_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  asana:      { label: "Asana",         bg: "bg-nia-grey-blue/15", text: "text-nia-grey-blue" },
  hub_ai:     { label: "AI Suggestion", bg: "bg-nia-orange/15",    text: "text-nia-orange" },
  hub_manual: { label: "Manual",        bg: "bg-surface-muted",    text: "text-text-muted" },
};

export function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function isOverdue(task: ProcessTask): boolean {
  if (!task.due_date || task.completed) return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.due_date < today;
}

export interface UnifiedTaskCardProps {
  task: ProcessTask;
  isSubtask?: boolean;
  onToggleComplete?: (taskId: number, currentCompleted: boolean) => void;
  isToggling?: boolean;
  onCardClick?: (task: ProcessTask, e?: React.MouseEvent) => void;
  onDueDateChange?: (taskId: number, date: string) => void;
  hasBlockers?: boolean;
  attachmentCount?: number;
  /** Whether this card is part of a multi-selection */
  isSelected?: boolean;
  /** Whether any task in the list is selected (keeps checkboxes visible) */
  isAnySelected?: boolean;
  /** Checkbox toggle handler (no modifier key needed) */
  onToggleSelection?: (taskId: number) => void;
  /** Right-click handler for context menu */
  onContextMenu?: (task: ProcessTask, e: React.MouseEvent) => void;
}

export default function UnifiedTaskCard({
  task,
  isSubtask,
  onToggleComplete,
  isToggling,
  onCardClick,
  onDueDateChange,
  hasBlockers,
  attachmentCount,
  isSelected,
  isAnySelected,
  onToggleSelection,
  onContextMenu,
}: UnifiedTaskCardProps) {
  const overdue = isOverdue(task);
  const badge = ORIGIN_BADGE[task.origin] || ORIGIN_BADGE.hub_manual;
  const showCheckbox = onToggleSelection && !isSubtask;

  return (
    <div
      onClick={(e) => onCardClick?.(task, e)}
      onContextMenu={(e) => onContextMenu?.(task, e)}
      className={`group/task bg-card rounded-lg border transition-colors cursor-pointer ${
        isSelected
          ? "ring-2 ring-nia-grey-blue/60 bg-nia-grey-blue/5 border-nia-grey-blue/30"
          : `border-border-light ${task.completed ? "opacity-50" : "hover:border-border hover:shadow-sm"}`
      } ${isSubtask ? "p-2" : "p-3"}`}
    >
      <div className="flex items-start gap-2">
        {/* Selection checkbox (square — distinct from circular completion toggle) */}
        {showCheckbox && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection(task.id);
            }}
            className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all ${
              isSelected
                ? "border-nia-grey-blue bg-nia-grey-blue"
                : "border-border hover:border-nia-grey-blue/50"
            } ${
              isAnySelected
                ? "opacity-100"
                : "opacity-0 group-hover/task:opacity-100"
            }`}
            aria-label={isSelected ? `Deselect "${task.title}"` : `Select "${task.title}"`}
          >
            {isSelected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

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
          aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
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
              {task.priority === "high" && !task.completed && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 align-middle" />
              )}
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

          {/* Meta row: assignee, due date, origin badge, blockers */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Assignee */}
            <span className={`text-[10px] ${task.assignee_name ? "text-text-secondary" : "text-text-muted"}`}>
              {task.assignee_name || "Unassigned"}
            </span>

            {/* Inline due date / date range (click to edit) */}
            <label
              onClick={(e) => e.stopPropagation()}
              className={`relative text-[10px] cursor-pointer hover:underline inline-flex items-center ${
                overdue ? "text-red-600 font-medium" : task.due_date ? "text-text-muted" : "text-text-muted/50"
              }`}
            >
              {task.start_date && task.due_date
                ? `${overdue ? "Overdue: " : ""}${formatDueDate(task.start_date)} – ${formatDueDate(task.due_date)}`
                : task.start_date && !task.due_date
                ? `Starts ${formatDueDate(task.start_date)}`
                : task.due_date
                ? `${overdue ? "Overdue: " : ""}${formatDueDate(task.due_date)}`
                : "Add due date"}
              <input
                type="date"
                value={task.due_date || ""}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onDueDateChange?.(task.id, e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label={`Due date for ${task.title}`}
              />
            </label>

            {/* Attachment count */}
            {(attachmentCount || 0) > 0 && (
              <span className="text-text-muted flex items-center gap-0.5 text-[10px]" title={`${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {attachmentCount}
              </span>
            )}

            {/* Blocker icon */}
            {hasBlockers && (
              <span className="text-amber-500 flex items-center gap-0.5" title="Has incomplete blockers">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </span>
            )}

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
