'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { DashboardSkeleton } from '@/components/skeleton';
import TaskDetailPanel from '@/components/task-detail-panel';
import TaskContextMenu, {
  getSingleTaskMenuItems,
  getBulkTaskMenuItems,
} from '@/components/task-context-menu';
import BulkActionToolbar from '@/components/bulk-action-toolbar';
import ConfirmDeleteModal from '@/components/confirm-delete-modal';
import Toast from '@/components/toast';
import { useTaskSelection } from '@/lib/use-task-selection';
import TaskListView from '@/components/task-list-view';
import type { ProcessTask, TaskPriority } from '@/lib/types';

interface MyTask extends ProcessTask {
  process_name: string;
  process_owner: string | null;
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>(
    'all'
  );
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');

  // Detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [savingField, setSavingField] = useState<string | null>(null);

  // Selection + context menu + bulk actions
  const {
    selectedIds,
    isAnySelected,
    isSelected,
    toggleId,
    handleTaskClick: selectionHandleClick,
    handleContextMenu: selectionHandleContextMenu,
    contextMenu,
    closeContextMenu,
    selectAll,
    clearSelection,
  } = useTaskSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [toastState, setToastState] = useState<{
    message: string;
    type: 'error' | 'success';
  } | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/my-tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // Client-side filtering
  const filtered = tasks.filter((t) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q))
        return false;
    }
    if (priorityFilter !== 'all' && (t.priority || 'medium') !== priorityFilter) return false;
    if (statusFilter === 'active' && t.completed) return false;
    if (statusFilter === 'completed' && !t.completed) return false;
    if (statusFilter === 'overdue') {
      if (t.completed || !t.due_date) return false;
      if (t.due_date >= new Date().toISOString().slice(0, 10)) return false;
    }
    return true;
  });

  // Group by process
  const grouped = new Map<string, MyTask[]>();
  for (const t of filtered) {
    const name = t.process_name || 'Unknown';
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(t);
  }

  // ── Task actions (same pattern as task-review-panel) ──

  async function handleToggleComplete(taskId: number, currentCompleted: boolean) {
    const newCompleted = !currentCompleted;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: newCompleted,
              status: newCompleted ? ('completed' as const) : ('active' as const),
            }
          : t
      )
    );
    setTogglingIds((prev) => new Set(prev).add(taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: currentCompleted,
                status: currentCompleted ? ('completed' as const) : ('active' as const),
              }
            : t
        )
      );
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }

  async function handleUpdateTask(taskId: number, fields: Partial<ProcessTask>) {
    const fieldName = Object.keys(fields)[0] || null;
    setSavingField(fieldName);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t)));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error();
    } catch {
      fetchTasks(); // Revert by re-fetching
    } finally {
      setSavingField(null);
    }
  }

  async function handleDeleteTask(taskId: number) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskId(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        fetchTasks(); // Revert
      }
    } catch {
      fetchTasks();
    }
  }

  // ── Bulk actions ──

  async function handleBulkUpdate(fields: Record<string, unknown>) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const snapshot = [...tasks];
    setTasks((prev) =>
      prev.map((t) => {
        if (!selectedIds.has(t.id)) return t;
        const updated = { ...t, ...fields };
        if (fields.completed !== undefined) {
          updated.completed = fields.completed as boolean;
          updated.status = fields.completed ? ('completed' as const) : ('active' as const);
        }
        return updated as MyTask;
      })
    );
    clearSelection();

    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ids, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk update failed');

      const msg =
        data.failed > 0
          ? `Updated ${data.updated} of ${ids.length} tasks. ${data.failed} failed.`
          : `Updated ${data.updated} task${data.updated !== 1 ? 's' : ''}`;
      setToastState({ message: msg, type: data.failed > 0 ? 'error' : 'success' });
    } catch {
      setTasks(snapshot);
      setToastState({ message: 'Bulk update failed', type: 'error' });
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);

    const snapshot = [...tasks];
    setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    clearSelection();
    setShowBulkDeleteConfirm(false);

    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');

      setToastState({
        message: `Deleted ${data.deleted} task${data.deleted !== 1 ? 's' : ''}`,
        type: data.failed > 0 ? 'error' : 'success',
      });
    } catch {
      setTasks(snapshot);
      setToastState({ message: 'Bulk delete failed', type: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  }

  function handleContextMenuAction(actionId: string) {
    closeContextMenu();
    const taskId = contextMenu?.taskId;

    if (actionId === 'complete' || actionId === 'uncomplete') {
      if (selectedIds.size > 1) {
        handleBulkUpdate({ completed: actionId === 'complete' });
      } else if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) handleToggleComplete(taskId, task.completed);
      }
      return;
    }

    if (actionId.startsWith('priority-') || actionId.startsWith('bulk-priority-')) {
      const priority = actionId.replace('bulk-priority-', '').replace('priority-', '');
      if (selectedIds.size > 1) {
        handleBulkUpdate({ priority });
      } else if (taskId) {
        handleUpdateTask(taskId, { priority } as Partial<ProcessTask>);
      }
      clearSelection();
      return;
    }

    if (actionId === 'assign' || actionId === 'bulk-assign') {
      if (selectedIds.size <= 1 && taskId) {
        setSelectedTaskId(taskId);
        clearSelection();
      }
      return;
    }

    if (actionId === 'set-due-date' || actionId === 'bulk-set-due-date') {
      if (selectedIds.size <= 1 && taskId) {
        setSelectedTaskId(taskId);
        clearSelection();
      }
      return;
    }

    if (actionId === 'open-in-asana' && taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task?.asana_task_url) window.open(task.asana_task_url, '_blank');
      clearSelection();
      return;
    }

    if (actionId === 'delete' || actionId === 'bulk-delete') {
      if (selectedIds.size > 1) {
        setShowBulkDeleteConfirm(true);
      } else if (taskId) {
        handleDeleteTask(taskId);
        clearSelection();
      }
      return;
    }

    if (actionId === 'bulk-complete') {
      handleBulkUpdate({ completed: true });
      return;
    }
  }

  if (loading) return <DashboardSkeleton />;

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;

  return (
    <div className="space-y-6 content-appear">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-nia-dark">My Tasks</h1>
          {isAnySelected && (
            <span className="text-sm font-medium text-nia-grey-blue bg-nia-grey-blue/10 px-2.5 py-1 rounded-full">
              {selectedIds.size} selected
            </span>
          )}
        </div>
        <p className="text-text-tertiary mt-1">All tasks assigned to you across every process.</p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View toggle */}
        <div className="flex bg-surface-muted rounded-lg p-0.5 mr-2">
          <button
            onClick={() => setViewMode('grouped')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grouped'
                ? 'bg-card shadow-sm text-nia-dark'
                : 'text-text-muted hover:text-foreground'
            }`}
            title="Grouped by process"
            aria-label="Grouped view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-card shadow-sm text-nia-dark'
                : 'text-text-muted hover:text-foreground'
            }`}
            title="List view"
            aria-label="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full text-sm bg-card border border-border-light rounded-lg pl-9 pr-3 py-2 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
          />
        </div>

        {/* Priority chips */}
        <div className="flex gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map((p) => {
            const isActive = priorityFilter === p;
            const chipColors: Record<string, string> = {
              all: isActive ? 'bg-nia-grey-blue/15 text-nia-grey-blue' : 'text-text-muted',
              high: isActive ? 'bg-red-500/15 text-red-600' : 'text-text-muted',
              medium: isActive ? 'bg-nia-orange/15 text-nia-orange' : 'text-text-muted',
              low: isActive ? 'bg-surface-muted text-text-secondary' : 'text-text-muted',
            };
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg capitalize transition-colors hover:bg-surface-hover ${chipColors[p]}`}
              >
                {p === 'all' ? 'All Priority' : p}
              </button>
            );
          })}
        </div>

        {/* Status chips */}
        <div className="flex gap-1">
          {(['all', 'active', 'completed', 'overdue'] as const).map((s) => {
            const isActive = statusFilter === s;
            const chipColors: Record<string, string> = {
              all: isActive ? 'bg-nia-grey-blue/15 text-nia-grey-blue' : 'text-text-muted',
              active: isActive ? 'bg-nia-grey-blue/15 text-nia-grey-blue' : 'text-text-muted',
              completed: isActive ? 'bg-nia-green/15 text-nia-green' : 'text-text-muted',
              overdue: isActive ? 'bg-red-500/15 text-red-600' : 'text-text-muted',
            };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg capitalize transition-colors hover:bg-surface-hover ${chipColors[s]}`}
              >
                {s === 'all' ? 'All Status' : s}
              </button>
            );
          })}
        </div>

        {/* Count */}
        {(debouncedSearch || priorityFilter !== 'all' || statusFilter !== 'all') && (
          <span className="text-xs text-text-muted ml-auto">
            {filtered.length} of {tasks.length} tasks
          </span>
        )}
      </div>

      {/* Task display */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-4">
          <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-nia-dark mb-1">
            {tasks.length === 0 ? 'No tasks assigned' : 'No tasks match filters'}
          </h3>
          <p className="text-sm text-text-tertiary max-w-sm">
            {tasks.length === 0
              ? 'Tasks assigned to you in any process will appear here.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <TaskListView
          tasks={filtered}
          onToggleComplete={handleToggleComplete}
          togglingTaskIds={togglingIds}
          onCardClick={(t) => setSelectedTaskId(t.id)}
          onDueDateChange={(id, date) =>
            handleUpdateTask(id, { due_date: date || null } as Partial<ProcessTask>)
          }
        />
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([processName, processTasks]) => {
            const groupIds = processTasks.map((t) => t.id);
            const allGroupSelected =
              groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
            const someGroupSelected = groupIds.some((id) => selectedIds.has(id));

            return (
              <Card key={processName} padding="md">
                {/* Process header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {/* Select All checkbox for this group */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allGroupSelected) {
                          // Deselect all in this group
                          groupIds.forEach((id) => {
                            if (selectedIds.has(id)) toggleId(id);
                          });
                        } else {
                          selectAll([...Array.from(selectedIds), ...groupIds]);
                        }
                      }}
                      className={`flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all ${
                        allGroupSelected
                          ? 'border-nia-grey-blue bg-nia-grey-blue'
                          : someGroupSelected
                            ? 'border-nia-grey-blue/50 bg-nia-grey-blue/20'
                            : 'border-border hover:border-nia-grey-blue/50'
                      } ${isAnySelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                      aria-label={
                        allGroupSelected
                          ? `Deselect all in ${processName}`
                          : `Select all in ${processName}`
                      }
                    >
                      {allGroupSelected && (
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
                      )}
                      {someGroupSelected && !allGroupSelected && (
                        <span className="w-2 h-0.5 bg-nia-grey-blue rounded-full" />
                      )}
                    </button>
                    <Link
                      href={`/processes/${processTasks[0].process_id}`}
                      className="text-sm font-semibold text-nia-dark hover:text-nia-orange transition-colors"
                    >
                      {processName}
                    </Link>
                  </div>
                  <span className="text-xs text-text-muted">
                    {processTasks.filter((t) => !t.completed).length} active
                  </span>
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {processTasks.map((task) => {
                    const overdue =
                      !task.completed &&
                      task.due_date &&
                      task.due_date < new Date().toISOString().slice(0, 10);
                    const orderedIds = processTasks.map((t) => t.id);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(e) => {
                          if (selectionHandleClick(task, e, orderedIds)) {
                            setSelectedTaskId(task.id);
                          }
                        }}
                        onContextMenu={(e) => selectionHandleContextMenu(task, e)}
                        className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-left group/row transition-colors ${
                          isSelected(task.id)
                            ? 'ring-2 ring-nia-grey-blue/60 bg-nia-grey-blue/5'
                            : 'hover:bg-surface-hover'
                        } ${task.completed ? 'opacity-50' : ''}`}
                      >
                        {/* Selection checkbox (square) */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleId(task.id);
                          }}
                          className={`flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all cursor-pointer ${
                            isSelected(task.id)
                              ? 'border-nia-grey-blue bg-nia-grey-blue'
                              : 'border-border hover:border-nia-grey-blue/50'
                          } ${
                            isAnySelected ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'
                          }`}
                          role="checkbox"
                          aria-checked={isSelected(task.id)}
                          aria-label={
                            isSelected(task.id)
                              ? `Deselect "${task.title}"`
                              : `Select "${task.title}"`
                          }
                        >
                          {isSelected(task.id) && (
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
                          )}
                        </span>

                        {/* Priority dot */}
                        {task.priority === 'high' && !task.completed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        )}

                        {/* Completion toggle (circle) */}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(task.id, task.completed);
                          }}
                          className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            task.completed
                              ? 'border-nia-green bg-nia-green'
                              : 'border-border hover:border-nia-green/50'
                          }`}
                        >
                          {task.completed && (
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
                          )}
                        </span>

                        {/* Title */}
                        <span
                          className={`text-sm flex-1 min-w-0 truncate ${
                            task.completed ? 'line-through text-text-muted' : 'text-nia-dark'
                          }`}
                        >
                          {task.title}
                        </span>

                        {/* Due date */}
                        {task.due_date && (
                          <span
                            className={`text-xs flex-shrink-0 ${
                              overdue ? 'text-red-600 font-medium' : 'text-text-muted'
                            }`}
                          >
                            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}

                        {/* Priority badge */}
                        {(task.priority || 'medium') !== 'medium' && (
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.5 rounded capitalize ${
                              task.priority === 'high'
                                ? 'bg-red-500/15 text-red-600'
                                : 'bg-surface-muted text-text-muted'
                            }`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onToggleComplete={handleToggleComplete}
          isToggling={togglingIds.has(selectedTask.id)}
          savingField={savingField}
        />
      )}

      {/* Context menu */}
      {contextMenu &&
        (() => {
          const ctxTask = tasks.find((t) => t.id === contextMenu.taskId);
          if (!ctxTask) return null;
          const items =
            selectedIds.size > 1
              ? getBulkTaskMenuItems(selectedIds.size)
              : getSingleTaskMenuItems(ctxTask);
          return (
            <TaskContextMenu
              position={contextMenu}
              items={items}
              onAction={handleContextMenuAction}
              onClose={closeContextMenu}
            />
          );
        })()}

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && !contextMenu && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onBulkComplete={() => handleBulkUpdate({ completed: true })}
          onBulkPriority={(p) => handleBulkUpdate({ priority: p })}
          onBulkAssign={(member) => {
            if (member) {
              handleBulkUpdate({
                assignee_name: member.name,
                assignee_email: member.email,
                assignee_asana_gid: member.gid,
              });
            } else {
              handleBulkUpdate({
                assignee_name: null,
                assignee_email: null,
                assignee_asana_gid: null,
              });
            }
          }}
          onBulkDueDate={(date) => handleBulkUpdate({ due_date: date })}
          onBulkDelete={() => setShowBulkDeleteConfirm(true)}
          onClearSelection={clearSelection}
        />
      )}

      {/* Bulk delete confirmation */}
      {showBulkDeleteConfirm && (
        <ConfirmDeleteModal
          title={`Delete ${selectedIds.size} tasks?`}
          description={`This will permanently delete ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}. Tasks synced with Asana will also be deleted there.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          confirmLabel={`Delete ${selectedIds.size} tasks`}
          loading={bulkDeleting}
        />
      )}

      {/* Toast */}
      {toastState && (
        <Toast
          message={toastState.message}
          type={toastState.type}
          onDismiss={() => setToastState(null)}
        />
      )}
    </div>
  );
}
