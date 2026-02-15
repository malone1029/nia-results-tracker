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
  onCardClick?: (task: ProcessTask) => void;
  onDueDateChange?: (taskId: number, date: string) => void;
}

export default function UnifiedTaskCard({
  task,
  isSubtask,
  onToggleComplete,
  isToggling,
  onCardClick,
  onDueDateChange,
}: UnifiedTaskCardProps) {
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
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onDueDateChange?.(task.id, e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label={`Due date for ${task.title}`}
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
