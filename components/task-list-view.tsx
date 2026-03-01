'use client';

import { useState } from 'react';
import type { ProcessTask, TaskPriority } from '@/lib/types';
import { PDCA_SECTIONS } from '@/lib/pdca';
import { formatDueDate, isOverdue, ORIGIN_BADGE } from '@/components/unified-task-card';

type SortKey = 'title' | 'assignee' | 'section' | 'priority' | 'due_date' | 'origin';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

interface TaskListViewProps {
  tasks: ProcessTask[];
  onToggleComplete: (taskId: number, currentCompleted: boolean) => void;
  togglingTaskIds: Set<number>;
  onCardClick: (task: ProcessTask) => void;
  onDueDateChange: (taskId: number, date: string) => void;
}

export default function TaskListView({
  tasks,
  onToggleComplete,
  togglingTaskIds,
  onCardClick,
  onDueDateChange,
}: TaskListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    // Always push completed to the bottom
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    let cmp = 0;
    switch (sortKey) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'assignee':
        cmp = (a.assignee_name || 'zzz').localeCompare(b.assignee_name || 'zzz');
        break;
      case 'section':
        cmp = a.pdca_section.localeCompare(b.pdca_section);
        break;
      case 'priority':
        cmp = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        break;
      case 'due_date':
        // No due date sorts to the end
        if (!a.due_date && !b.due_date) cmp = 0;
        else if (!a.due_date) cmp = 1;
        else if (!b.due_date) cmp = -1;
        else cmp = a.due_date.localeCompare(b.due_date);
        break;
      case 'origin':
        cmp = a.origin.localeCompare(b.origin);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function SortHeader({
    label,
    columnKey,
    className,
  }: {
    label: string;
    columnKey: SortKey;
    className?: string;
  }) {
    const isActive = sortKey === columnKey;
    return (
      <th
        scope="col"
        className={`text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide px-3 py-2 cursor-pointer select-none hover:text-foreground transition-colors ${className || ''}`}
        onClick={() => handleSort(columnKey)}
        aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {isActive && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
              />
            </svg>
          )}
        </span>
      </th>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-text-muted">No tasks match your filters.</div>
    );
  }

  return (
    <div className="bg-surface-hover rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-light">
              <th scope="col" className="w-8 px-3 py-2">
                <span className="sr-only">Complete</span>
              </th>
              <SortHeader label="Task" columnKey="title" />
              <SortHeader label="Assignee" columnKey="assignee" className="hidden sm:table-cell" />
              <SortHeader label="Section" columnKey="section" className="hidden sm:table-cell" />
              <SortHeader label="Priority" columnKey="priority" />
              <SortHeader label="Due" columnKey="due_date" />
              <SortHeader label="Origin" columnKey="origin" className="hidden md:table-cell" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => {
              const overdue = isOverdue(task);
              const badge = ORIGIN_BADGE[task.origin] || ORIGIN_BADGE.hub_manual;
              const pdca = PDCA_SECTIONS[task.pdca_section];
              const priorityStyles: Record<TaskPriority, string> = {
                high: 'bg-red-500/15 text-red-600',
                medium: 'bg-nia-orange/15 text-nia-orange',
                low: 'bg-surface-muted text-text-muted',
              };

              return (
                <tr
                  key={task.id}
                  onClick={() => onCardClick(task)}
                  className={`border-b border-border-light/50 cursor-pointer transition-colors hover:bg-surface-hover/80 ${
                    task.completed ? 'opacity-50' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(task.id, task.completed);
                      }}
                      disabled={togglingTaskIds.has(task.id) || task.status === 'pending'}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'border-nia-green bg-nia-green'
                          : 'border-border hover:border-nia-green/50'
                      } ${task.status === 'pending' ? 'opacity-30' : 'cursor-pointer'}`}
                      aria-label={
                        task.completed
                          ? `Mark "${task.title}" incomplete`
                          : `Mark "${task.title}" complete`
                      }
                    >
                      {togglingTaskIds.has(task.id) ? (
                        <svg
                          className="w-2.5 h-2.5 text-text-muted animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : task.completed ? (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : null}
                    </button>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {task.priority === 'high' && !task.completed && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm ${task.completed ? 'line-through text-text-tertiary' : 'text-nia-dark font-medium'}`}
                      >
                        {task.title}
                      </span>
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <span className="text-xs text-text-secondary">{task.assignee_name || '—'}</span>
                  </td>

                  {/* Section */}
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {pdca && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: pdca.color + '20',
                          color: pdca.color,
                        }}
                      >
                        {pdca.label}
                      </span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${priorityStyles[task.priority || 'medium']}`}
                    >
                      {task.priority || 'medium'}
                    </span>
                  </td>

                  {/* Due date */}
                  <td className="px-3 py-2.5">
                    {task.due_date ? (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`relative text-xs cursor-pointer hover:underline ${
                          overdue ? 'text-red-600 font-medium' : 'text-text-muted'
                        }`}
                      >
                        {overdue ? 'Overdue: ' : ''}
                        {formatDueDate(task.due_date)}
                        <input
                          type="date"
                          value={task.due_date || ''}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onDueDateChange(task.id, e.target.value);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label={`Due date for ${task.title}`}
                        />
                      </label>
                    ) : (
                      <span className="text-xs text-text-muted/50">—</span>
                    )}
                  </td>

                  {/* Origin */}
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
