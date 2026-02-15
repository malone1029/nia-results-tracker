"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import type { DashboardTask, DashboardTaskData } from "./types";

/* ─── Task row ─────────────────────────────────────────────── */

function TaskRow({
  task,
  accent,
  muted,
  onToggle,
}: {
  task: DashboardTask;
  accent: "red" | "orange" | "green";
  muted?: boolean;
  onToggle: (id: number, completed: boolean) => void;
}) {
  const dueLabel = task.due_date
    ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const accentColors = {
    red: "bg-red-500",
    orange: "bg-nia-orange",
    green: "bg-nia-green",
  };

  return (
    <div
      className={`flex items-center gap-2.5 py-2 px-3 rounded-lg group transition-colors hover:bg-surface-hover ${
        muted ? "opacity-60" : ""
      }`}
    >
      {/* Left accent bar */}
      <div className={`w-0.5 h-6 rounded-full flex-shrink-0 ${accentColors[accent]}`} />

      {/* Completion checkbox */}
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors hover:border-nia-green focus:outline-none focus:ring-2 focus:ring-nia-green/30"
        style={{
          borderColor: task.completed ? "#b1bd37" : "var(--border)",
          backgroundColor: task.completed ? "#b1bd37" : "transparent",
        }}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {task.completed && (
          <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Task title */}
      <span
        className={`text-sm flex-1 min-w-0 truncate ${
          task.completed ? "line-through text-text-muted" : "text-nia-dark"
        }`}
      >
        {task.title}
      </span>

      {/* Process name (linked) */}
      <Link
        href={`/processes/${task.process_id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-xs text-text-muted hover:text-nia-orange transition-colors truncate max-w-[140px] hidden sm:inline flex-shrink-0"
      >
        {task.process_name}
      </Link>

      {/* Due date */}
      {dueLabel && (
        <span
          className={`text-xs flex-shrink-0 ${
            accent === "red" ? "text-red-600 font-medium" : "text-text-muted"
          }`}
        >
          {dueLabel}
        </span>
      )}
    </div>
  );
}

/* ─── Section header ───────────────────────────────────────── */

function SectionLabel({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        {label}
      </span>
      <Badge color={count > 0 ? "gray" : "gray"} size="xs">
        {count}
      </Badge>
    </div>
  );
}

/* ─── TaskHub ──────────────────────────────────────────────── */

export default function TaskHub({
  data,
  isAllOwners,
  onRefresh,
}: {
  data: DashboardTaskData;
  isAllOwners: boolean;
  onRefresh: () => void;
}) {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<number, boolean>>(new Map());

  const handleToggle = async (taskId: number, completed: boolean) => {
    // Optimistic update
    setOptimisticUpdates((prev) => new Map(prev).set(taskId, completed));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!res.ok) {
        // Revert on failure
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(taskId);
          return next;
        });
        return;
      }

      // Success — refresh dashboard data to move task between sections
      onRefresh();
    } catch {
      // Revert on network error
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Apply optimistic state to tasks
  const applyOptimistic = (task: DashboardTask): DashboardTask => {
    const override = optimisticUpdates.get(task.id);
    if (override !== undefined) {
      return { ...task, completed: override };
    }
    return task;
  };

  const overdue = data.overdue.map(applyOptimistic);
  const upcoming = data.upcoming.map(applyOptimistic);
  const completed = data.recentlyCompleted.map(applyOptimistic);
  const stats = data.stats;

  const hasNoTasks = overdue.length === 0 && upcoming.length === 0 && completed.length === 0;

  return (
    <Card padding="md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">
          {isAllOwners ? "Tasks" : "My Tasks"}
        </h2>
      </div>

      {/* Mini stat chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {stats.totalOverdue > 0 && (
          <Badge color="red" size="sm" dot>
            {stats.totalOverdue} Overdue
          </Badge>
        )}
        <Badge color={upcoming.length > 0 ? "orange" : "gray"} size="sm" dot>
          {upcoming.length} Due Soon
        </Badge>
        <Badge color="dark" size="sm" dot>
          {stats.totalActive} Active
        </Badge>
        {(stats.totalActive + stats.totalCompleted) > 0 && (
          <Badge color="green" size="sm" dot>
            {stats.completionRate}% Done
          </Badge>
        )}
      </div>

      {hasNoTasks ? (
        <div className="text-center py-6">
          <p className="text-sm text-text-muted">No active tasks</p>
          <Link
            href="/processes"
            className="text-xs text-nia-grey-blue hover:text-nia-orange mt-1 inline-block"
          >
            View processes to add tasks
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Overdue */}
          {overdue.length > 0 && (
            <>
              <SectionLabel label="Overdue" count={overdue.length} color="#dc2626" />
              {overdue.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  accent="red"
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <>
              <SectionLabel label="Coming Up" count={upcoming.length} color="#f79935" />
              {upcoming.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  accent="orange"
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}

          {/* Recently Completed */}
          {completed.length > 0 && (
            <>
              <SectionLabel label="Recently Completed" count={completed.length} color="#b1bd37" />
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  accent="green"
                  muted
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
