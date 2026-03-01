'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  rectIntersection,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PDCA_SECTIONS } from '@/lib/pdca';
import HelpTip from '@/components/help-tip';
import Toast from '@/components/toast';
import TaskDetailPanel from '@/components/task-detail-panel';
import TaskCreatePanel from '@/components/task-create-panel';
import UnifiedTaskCard from '@/components/unified-task-card';
import SortableTaskCard from '@/components/sortable-task-card';
import TaskContextMenu, {
  getSingleTaskMenuItems,
  getBulkTaskMenuItems,
} from '@/components/task-context-menu';
import BulkActionToolbar from '@/components/bulk-action-toolbar';
import ConfirmDeleteModal from '@/components/confirm-delete-modal';
import { useTaskSelection } from '@/lib/use-task-selection';
import TaskListView from '@/components/task-list-view';
import type { PdcaSection, ProcessTask, TaskPriority } from '@/lib/types';

// ── Constants ────────────────────────────────────────────────

const PDCA_KEYS: PdcaSection[] = ['plan', 'execute', 'evaluate', 'improve'];
const SYNC_COOLDOWN_MS = 2 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 10 * 1000;

// ── Helpers ──────────────────────────────────────────────────

function formatSyncTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

/** Match Asana section name to a PDCA section (case-insensitive) */
function matchPdcaSection(sectionName: string): PdcaSection | null {
  const lower = sectionName.toLowerCase().trim();
  if (PDCA_KEYS.includes(lower as PdcaSection)) return lower as PdcaSection;
  return null;
}

/** Group tasks by section, preserving Asana section names with PDCA color matching */
interface TaskSection {
  key: string; // unique key for React
  label: string; // display name
  pdcaMatch: PdcaSection | null; // PDCA match for color coding
  tasks: ProcessTask[]; // non-subtask tasks (subtasks are nested)
  completedCount: number;
  totalCount: number;
}

function buildSections(tasks: ProcessTask[]): TaskSection[] {
  // Separate tasks by origin type
  const asanaTasks = tasks.filter((t) => t.origin === 'asana' && !t.is_subtask);
  const hubTasks = tasks.filter((t) => t.origin !== 'asana' && t.status !== 'pending');

  // Group Asana tasks by section name
  const asanaSectionMap = new Map<string, ProcessTask[]>();
  for (const t of asanaTasks) {
    const key = t.asana_section_name || 'Uncategorized';
    if (!asanaSectionMap.has(key)) asanaSectionMap.set(key, []);
    asanaSectionMap.get(key)!.push(t);
  }

  const sections: TaskSection[] = [];

  // Asana sections (in order they appear)
  for (const [sectionName, sectionTasks] of asanaSectionMap) {
    const completedCount = sectionTasks.filter((t) => t.completed).length;
    // Count subtasks too
    const subtaskGids = sectionTasks.map((t) => t.asana_task_gid).filter(Boolean);
    const subtasks = tasks.filter(
      (t) => t.is_subtask && t.parent_asana_gid && subtaskGids.includes(t.parent_asana_gid)
    );
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
  const hubByPdca = new Map<PdcaSection, ProcessTask[]>();
  for (const t of hubTasks) {
    const section = t.pdca_section;
    if (!hubByPdca.has(section)) hubByPdca.set(section, []);
    hubByPdca.get(section)!.push(t);
  }

  for (const key of PDCA_KEYS) {
    const sectionTasks = hubByPdca.get(key) || [];

    // Check if this PDCA section already exists as an Asana section
    const existingSection = sections.find((s) => s.pdcaMatch === key);
    if (existingSection) {
      // Merge hub tasks into the existing Asana section
      if (sectionTasks.length > 0) {
        existingSection.tasks = sortTasks([...existingSection.tasks, ...sectionTasks]);
        existingSection.totalCount += sectionTasks.length;
        existingSection.completedCount += sectionTasks.filter(
          (t) => t.status === 'completed'
        ).length;
      }
    } else {
      // Always create the PDCA section (even if empty) so "+ Add task" is visible
      sections.push({
        key: `hub-${key}`,
        label: PDCA_SECTIONS[key].label,
        pdcaMatch: key,
        tasks: sortTasks(sectionTasks),
        completedCount: sectionTasks.filter((t) => t.status === 'completed').length,
        totalCount: sectionTasks.length,
      });
    }
  }

  return sections;
}

/** Sort tasks: active first (by sort_order), then completed (dimmed, by sort_order) */
function sortTasks(tasks: ProcessTask[]): ProcessTask[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

// ── Main Component ──────────────────────────────────────────

interface TaskReviewPanelProps {
  processId: number;
  asanaProjectGid?: string | null;
  onTaskCountChange?: (count: number) => void;
}

export default function TaskReviewPanel({
  processId,
  asanaProjectGid,
  onTaskCountChange,
}: TaskReviewPanelProps) {
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    exported: number;
    failed: number;
    sectionCounts: Record<string, number>;
    asanaUrl: string;
    errors?: string[];
  } | null>(null);
  const [error, setError] = useState('');

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
  const snapshotsRef = useRef<Map<number, ProcessTask>>(new Map());
  const [toastState, setToastState] = useState<{
    message: string;
    type: 'error' | 'success';
    retry?: () => void;
  } | null>(null);

  // Create task state
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [createPdcaDefault, setCreatePdcaDefault] = useState<PdcaSection>('plan');

  // Filter state
  const [filterSearch, setFilterSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'overdue'>(
    'all'
  );
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection + context menu state
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

  // View mode state
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Blocker tracking
  const [taskBlockerMap, setTaskBlockerMap] = useState<Map<number, boolean>>(new Map());

  // Attachment count tracking
  const [attachmentCounts, setAttachmentCounts] = useState<Map<number, number>>(new Map());

  // DnD state
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // DnD sensors: mouse needs 5px movement to start, touch needs 200ms hold
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?processId=${processId}`);
      if (res.ok) {
        const data: ProcessTask[] = await res.json();
        setTasks(data);
        onTaskCountChange?.(data.filter((t) => t.status === 'pending').length);

        const syncedTasks = data.filter((t) => t.last_synced_at);
        if (syncedTasks.length > 0) {
          const latest = syncedTasks.reduce((a, b) =>
            a.last_synced_at! > b.last_synced_at! ? a : b
          );
          setLastSyncedAt(latest.last_synced_at);
        }
      }
    } catch {
      setError('Failed to load tasks');
    }
    setLoading(false);
  }, [processId, onTaskCountChange]);

  const syncFromAsana = useCallback(async () => {
    if (!asanaProjectGid || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/asana/sync-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'not_connected') {
          setSyncError('Asana token expired. Reconnect in Settings.');
        } else {
          setSyncError(data.message || data.error || 'Sync failed');
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

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch blocker status for all tasks (lightweight — just checks for incomplete blockers)
  useEffect(() => {
    if (tasks.length === 0) return;
    const activeTasks = tasks.filter((t) => !t.completed && !t.is_subtask);
    if (activeTasks.length === 0) return;

    // Batch fetch dependencies for tasks that have them
    Promise.all(
      activeTasks.map(async (t) => {
        try {
          const res = await fetch(`/api/tasks/${t.id}/dependencies`);
          if (!res.ok) return { id: t.id, hasBlockers: false };
          const data = await res.json();
          const hasBlockers = (data.blockedBy || []).some(
            (d: { completed: boolean }) => !d.completed
          );
          return { id: t.id, hasBlockers };
        } catch {
          return { id: t.id, hasBlockers: false };
        }
      })
    ).then((results) => {
      const map = new Map<number, boolean>();
      for (const r of results) {
        if (r.hasBlockers) map.set(r.id, true);
      }
      setTaskBlockerMap(map);
    });
  }, [tasks]);

  // Fetch attachment counts for all tasks
  useEffect(() => {
    if (tasks.length === 0) return;
    const nonSubtasks = tasks.filter((t) => !t.is_subtask);
    if (nonSubtasks.length === 0) return;

    Promise.all(
      nonSubtasks.map(async (t) => {
        try {
          const res = await fetch(`/api/tasks/${t.id}/attachments`);
          if (!res.ok) return { id: t.id, count: 0 };
          const data = await res.json();
          return { id: t.id, count: Array.isArray(data) ? data.length : 0 };
        } catch {
          return { id: t.id, count: 0 };
        }
      })
    ).then((results) => {
      const map = new Map<number, number>();
      for (const r of results) {
        if (r.count > 0) map.set(r.id, r.count);
      }
      setAttachmentCounts(map);
    });
  }, [tasks]);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(filterSearch), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filterSearch]);

  useEffect(() => {
    if (!asanaProjectGid || syncTriggeredRef.current) return;
    syncTriggeredRef.current = true;
    const shouldSync =
      !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > SYNC_COOLDOWN_MS;
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
    const snapshot = tasks.find((t) => t.id === taskId);
    if (!snapshot) return;

    // Store pre-edit snapshot (only if not already in-flight for this task)
    if (!snapshotsRef.current.has(taskId)) {
      snapshotsRef.current.set(taskId, snapshot);
    }

    const newCompleted = !currentCompleted;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
              status: newCompleted ? ('completed' as const) : ('active' as const),
            }
          : t
      )
    );
    setTogglingTaskIds((prev) => new Set(prev).add(taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Update failed');
      }

      // Check for blocker warning
      const data = await res.json().catch(() => ({}));
      if (data.warning === 'completed_with_blockers') {
        setToastState({
          message: `Completed with ${data.blockerCount} incomplete blocker${data.blockerCount > 1 ? 's' : ''}`,
          type: 'success',
        });
      }

      // Success — clear snapshot
      snapshotsRef.current.delete(taskId);
    } catch (err) {
      // Revert to original pre-edit state
      const original = snapshotsRef.current.get(taskId);
      if (original) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? original : t)));
        snapshotsRef.current.delete(taskId);
      }
      setToastState({
        message: (err as Error).message || "Couldn't update task. Please try again.",
        type: 'error',
        retry: () => handleToggleComplete(taskId, currentCompleted),
      });
    } finally {
      setTogglingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }

  // ── Generic update (optimistic UI with revert) ──

  async function handleUpdateTask(taskId: number, fields: Partial<ProcessTask>) {
    const snapshot = tasks.find((t) => t.id === taskId);
    if (!snapshot) return;

    // Store pre-edit snapshot (only first in-flight edit per task)
    if (!snapshotsRef.current.has(taskId)) {
      snapshotsRef.current.set(taskId, snapshot);
    }

    const fieldName = Object.keys(fields)[0] || null;
    setSavingField(fieldName);

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t)));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Update failed');
      }
      snapshotsRef.current.delete(taskId);
    } catch (err) {
      const original = snapshotsRef.current.get(taskId);
      if (original) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? original : t)));
        snapshotsRef.current.delete(taskId);
      }
      setToastState({
        message: (err as Error).message || "Couldn't update task. Please try again.",
        type: 'error',
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
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 502) {
          throw new Error(
            data.message || "Couldn't delete from Asana. Try again or disconnect Asana first."
          );
        }
        throw new Error(data.message || 'Delete failed');
      }
      setToastState({ message: 'Task deleted', type: 'success' });
    } catch (err) {
      // Revert
      setTasks((prev) => [...prev, snapshot]);
      setToastState({
        message: (err as Error).message || "Couldn't delete task. Please try again.",
        type: 'error',
        retry: () => handleDeleteTask(taskId),
      });
    }
  }

  // ── Task created from form ──

  function handleTaskCreated(newTask: ProcessTask) {
    setTasks((prev) => [...prev, newTask]);
    setCreatePanelOpen(false);
    // Check if Asana sync failed (flag set by POST /api/tasks)
    const syncFailed = (newTask as ProcessTask & { asana_sync_failed?: boolean }).asana_sync_failed;
    if (syncFailed) {
      setToastState({
        message: 'Task created but Asana sync failed. You can export it later.',
        type: 'error',
      });
    } else {
      setToastState({ message: 'Task created', type: 'success' });
    }
  }

  // ── Drag-and-drop ──

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as number);
    clearSelection(); // DnD clears multi-selection (multi-drag not supported in v1)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as number;
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Determine the target: is "over" a task or a section droppable?
    const overIdStr = String(over.id);
    const isSectionDrop = overIdStr.startsWith('section-');

    if (isSectionDrop) {
      // Dropped on a section container — move to that section at the end
      const targetPdca = overIdStr.replace('section-', '') as PdcaSection;
      if (!PDCA_KEYS.includes(targetPdca)) return;
      if (activeTask.pdca_section === targetPdca) return; // Already in this section

      await handleCrossSectionMove(activeTask, targetPdca);
      return;
    }

    // "over" is a task — check if same or different section
    const overId = over.id as number;
    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    if (activeTask.pdca_section === overTask.pdca_section) {
      // ── Within-section reorder ──
      const sectionTasks = tasks
        .filter(
          (t) =>
            !t.is_subtask && t.status !== 'pending' && t.pdca_section === activeTask.pdca_section
        )
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const oldIndex = sectionTasks.findIndex((t) => t.id === activeId);
      const newIndex = sectionTasks.findIndex((t) => t.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...sectionTasks];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      const updates: { id: number; sort_order: number }[] = reordered.map((t, i) => ({
        id: t.id,
        sort_order: (i + 1) * 1000,
      }));

      const snapshot = [...tasks];
      setTasks((prev) => {
        const next = [...prev];
        for (const u of updates) {
          const idx = next.findIndex((t) => t.id === u.id);
          if (idx !== -1) next[idx] = { ...next[idx], sort_order: u.sort_order };
        }
        return next;
      });

      try {
        const res = await fetch('/api/tasks/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) throw new Error('Reorder failed');
      } catch {
        setTasks(snapshot);
        setToastState({
          message: "Couldn't save new order. Please try again.",
          type: 'error',
        });
      }
    } else {
      // ── Cross-section move ──
      await handleCrossSectionMove(activeTask, overTask.pdca_section);
    }
  }

  /** Move a task to a different PDCA section */
  async function handleCrossSectionMove(task: ProcessTask, targetPdca: PdcaSection) {
    const targetLabel = PDCA_SECTIONS[targetPdca].label;

    // Calculate sort_order for the end of the target section
    const targetTasks = tasks.filter(
      (t) => t.pdca_section === targetPdca && !t.is_subtask && t.status !== 'pending'
    );
    const maxSortOrder = targetTasks.reduce((max, t) => Math.max(max, t.sort_order ?? 0), 0);
    const newSortOrder = maxSortOrder + 1000;

    // Optimistic update
    const snapshot = [...tasks];
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              pdca_section: targetPdca,
              asana_section_name: targetLabel,
              sort_order: newSortOrder,
            }
          : t
      )
    );

    // Persist via PATCH /api/tasks/{id} (handles Asana section move)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdca_section: targetPdca,
          sort_order: newSortOrder,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Move failed');
      }
      setToastState({
        message: `Moved to ${targetLabel}`,
        type: 'success',
      });
    } catch (err) {
      setTasks(snapshot);
      setToastState({
        message: (err as Error).message || "Couldn't move task. Please try again.",
        type: 'error',
      });
    }
  }

  // ── Keep / Dismiss for AI suggestions ──

  async function handleKeep(taskId: number) {
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'active' }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'active' as const } : t))
        );
        onTaskCountChange?.(tasks.filter((t) => t.id !== taskId && t.status === 'pending').length);
      }
    } catch {
      setError('Failed to keep task');
    } finally {
      setSaving(false);
    }
  }

  async function handleDismiss(taskId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = tasks.filter((t) => t.id !== taskId);
        setTasks(updated);
        onTaskCountChange?.(updated.filter((t) => t.status === 'pending').length);
      }
    } catch {
      setError('Failed to dismiss task');
    } finally {
      setSaving(false);
    }
  }

  // ── Export to Asana ──

  async function handleExportToAsana() {
    setExporting(true);
    setError('');
    setExportResult(null);
    try {
      const res = await fetch('/api/tasks/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'not_linked') {
          setError(data.message || 'Process not linked to Asana.');
        } else if (data.error === 'not_connected') {
          setError(data.message || 'Asana not connected.');
        } else {
          setError(data.error || 'Export failed');
        }
        return;
      }
      setExportResult(data);
      fetchTasks();
    } catch {
      setError('Export to Asana failed');
    } finally {
      setExporting(false);
    }
  }

  // ── Bulk actions ──

  async function handleBulkUpdate(fields: Record<string, unknown>) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Optimistic update
    const snapshot = [...tasks];
    setTasks((prev) =>
      prev.map((t) => {
        if (!selectedIds.has(t.id)) return t;
        const updated = { ...t, ...fields };
        if (fields.completed !== undefined) {
          updated.completed = fields.completed as boolean;
          updated.completed_at = fields.completed ? new Date().toISOString() : null;
          updated.status = fields.completed ? ('completed' as const) : ('active' as const);
        }
        return updated as ProcessTask;
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
      setToastState({
        message: data.asanaErrors?.length ? `${msg} ${data.asanaErrors[0]}` : msg,
        type: data.failed > 0 ? 'error' : 'success',
      });
    } catch (err) {
      setTasks(snapshot);
      setToastState({
        message: (err as Error).message || 'Bulk update failed',
        type: 'error',
      });
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);

    // Optimistic remove
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

      const msg =
        data.failed > 0
          ? `Deleted ${data.deleted} of ${ids.length} tasks. ${data.failed} failed.`
          : `Deleted ${data.deleted} task${data.deleted !== 1 ? 's' : ''}`;
      setToastState({ message: msg, type: data.failed > 0 ? 'error' : 'success' });
    } catch (err) {
      setTasks(snapshot);
      setToastState({
        message: (err as Error).message || 'Bulk delete failed',
        type: 'error',
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  /** Dispatch context menu actions */
  function handleContextMenuAction(actionId: string) {
    closeContextMenu();
    const taskId = contextMenu?.taskId;

    // Single task actions
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
      const priority = actionId
        .replace('bulk-priority-', '')
        .replace('priority-', '') as TaskPriority;
      if (selectedIds.size > 1) {
        handleBulkUpdate({ priority });
      } else if (taskId) {
        handleUpdateTask(taskId, { priority } as Partial<ProcessTask>);
      }
      clearSelection();
      return;
    }

    if (actionId === 'assign' || actionId === 'bulk-assign') {
      // Assign is handled via toolbar — just open detail panel for single
      if (selectedIds.size <= 1 && taskId) {
        setSelectedTaskId(taskId);
        clearSelection();
      }
      return;
    }

    if (actionId === 'set-due-date' || actionId === 'bulk-set-due-date') {
      // Due date is handled via toolbar — just open detail panel for single
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

    // Bulk-specific actions
    if (actionId === 'bulk-complete') {
      handleBulkUpdate({ completed: true });
      return;
    }
  }

  // ── Derived data ──

  const pendingSuggestions = tasks.filter((t) => t.origin === 'hub_ai' && t.status === 'pending');

  // ── Client-side filtering ──
  const hasFilters = debouncedSearch !== '' || filterPriority !== 'all' || filterStatus !== 'all';
  const filteredTasks = hasFilters
    ? tasks.filter((t) => {
        // Search filter (title + description)
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        }
        // Priority filter
        if (filterPriority !== 'all' && (t.priority || 'medium') !== filterPriority) return false;
        // Status filter
        if (filterStatus === 'active' && (t.completed || t.status === 'pending')) return false;
        if (filterStatus === 'completed' && !t.completed) return false;
        if (filterStatus === 'overdue') {
          if (t.completed || !t.due_date) return false;
          const today = new Date().toISOString().slice(0, 10);
          if (t.due_date >= today) return false;
        }
        return true;
      })
    : tasks;

  const sections = buildSections(filteredTasks);
  const allSubtasks = filteredTasks.filter((t) => t.is_subtask);
  const pendingCount = pendingSuggestions.length;
  // Tasks that can be synced to Asana: active hub tasks without an Asana GID
  const unsyncedTasks = tasks.filter(
    (t) => ['active', 'pending'].includes(t.status) && !t.asana_task_gid && t.origin !== 'asana'
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
        <h3 className="text-lg font-semibold text-nia-dark mb-1">No tasks yet</h3>
        <p className="text-sm text-text-tertiary max-w-sm mb-4">
          {asanaProjectGid
            ? 'Tasks will appear here after syncing from Asana, or use the AI coach to generate improvement suggestions.'
            : 'Link this process to an Asana project to import tasks, or use the AI coach to generate improvement suggestions.'}
        </p>
        <button
          onClick={() => {
            setCreatePdcaDefault('plan');
            setCreatePanelOpen(true);
          }}
          className="bg-nia-grey-blue text-white rounded-lg py-2 px-4 text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
        {createPanelOpen && (
          <TaskCreatePanel
            processId={processId}
            asanaProjectGid={asanaProjectGid}
            defaultPdcaSection={createPdcaDefault}
            onCreated={handleTaskCreated}
            onClose={() => setCreatePanelOpen(false)}
          />
        )}
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
                Created {exportResult.exported} task{exportResult.exported !== 1 ? 's' : ''} in
                Asana
                {exportResult.failed > 0 && ` (${exportResult.failed} failed)`}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {Object.entries(exportResult.sectionCounts)
                  .map(([s, c]) => `${c} ${s}`)
                  .join(', ')}
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
            {syncError.includes('Reconnect') && (
              <a
                href="/settings"
                className="text-xs font-medium text-nia-grey-blue hover:text-nia-dark"
              >
                Reconnect Asana
              </a>
            )}
            <button
              onClick={() => setSyncError(null)}
              className="text-xs text-text-tertiary hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-nia-red/10 border border-nia-red/20 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-nia-red">{error}</span>
          <button
            onClick={() => setError('')}
            className="text-xs text-text-tertiary hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-tertiary">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {pendingCount > 0 && ` (${pendingCount} to review)`}
            <HelpTip text="Tasks from Asana, AI suggestions, and manual entries — all in one view." />
          </span>
          {isAnySelected && (
            <span className="text-xs font-medium text-nia-grey-blue bg-nia-grey-blue/10 px-2 py-0.5 rounded-full">
              {selectedIds.size} selected
            </span>
          )}
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
                title={
                  syncing ? 'Syncing...' : refreshCooldown ? 'Please wait...' : 'Refresh from Asana'
                }
              >
                <svg
                  className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-surface-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'board'
                  ? 'bg-card shadow-sm text-nia-dark'
                  : 'text-text-muted hover:text-foreground'
              }`}
              title="Board view"
              aria-label="Board view"
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

          {unsyncedTasks.length > 0 && (
            <button
              onClick={handleExportToAsana}
              disabled={exporting}
              className="bg-nia-green text-white rounded-lg py-2 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {exporting ? 'Syncing...' : `Sync ${unsyncedTasks.length} to Asana`}
            </button>
          )}
          <button
            onClick={() => {
              setCreatePdcaDefault('plan');
              setCreatePanelOpen(true);
            }}
            className="bg-nia-grey-blue text-white rounded-lg py-2 px-4 text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Task
          </button>
        </div>
      </div>

      {/* ═══ FILTER BAR ═══ */}
      {tasks.length > 3 && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted"
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
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full text-xs bg-surface-hover border border-border-light rounded-lg pl-8 pr-3 py-1.5 text-foreground placeholder:text-text-muted focus:outline-none focus:border-nia-grey-blue"
            />
          </div>

          {/* Priority chips */}
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map((p) => {
              const isActive = filterPriority === p;
              const chipStyles: Record<string, string> = {
                all: isActive ? 'bg-nia-grey-blue/15 text-nia-grey-blue' : 'text-text-muted',
                high: isActive ? 'bg-red-500/15 text-red-600' : 'text-text-muted',
                medium: isActive ? 'bg-nia-orange/15 text-nia-orange' : 'text-text-muted',
                low: isActive ? 'bg-surface-muted text-text-secondary' : 'text-text-muted',
              };
              return (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`text-[10px] font-medium px-2 py-1 rounded-md capitalize transition-colors hover:bg-surface-hover ${chipStyles[p]}`}
                >
                  {p === 'all' ? 'All' : p}
                </button>
              );
            })}
          </div>

          {/* Status chips */}
          <div className="flex gap-1">
            {(['all', 'active', 'completed', 'overdue'] as const).map((s) => {
              const isActive = filterStatus === s;
              const chipStyles: Record<string, string> = {
                all: isActive ? 'bg-nia-grey-blue/15 text-nia-grey-blue' : 'text-text-muted',
                active: isActive ? 'bg-nia-grey-blue/15 text-nia-grey-blue' : 'text-text-muted',
                completed: isActive ? 'bg-nia-green/15 text-nia-green' : 'text-text-muted',
                overdue: isActive ? 'bg-red-500/15 text-red-600' : 'text-text-muted',
              };
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-[10px] font-medium px-2 py-1 rounded-md capitalize transition-colors hover:bg-surface-hover ${chipStyles[s]}`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              );
            })}
          </div>

          {/* Result count when filtering */}
          {hasFilters && (
            <span className="text-[10px] text-text-muted ml-auto">
              Showing {filteredTasks.filter((t) => t.status !== 'pending').length} of{' '}
              {tasks.filter((t) => t.status !== 'pending').length} tasks
            </span>
          )}
        </div>
      )}

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
                      <p className="text-xs text-text-tertiary mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: PDCA_SECTIONS[task.pdca_section].color + '20',
                          color: PDCA_SECTIONS[task.pdca_section].color,
                        }}
                      >
                        {PDCA_SECTIONS[task.pdca_section].label}
                      </span>
                      {task.source_detail && (
                        <span className="text-[10px] text-text-muted">
                          From: {task.source_detail}
                        </span>
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDismiss(task.id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-nia-red/10 text-nia-red hover:bg-nia-red/20 transition-colors"
                      title="Dismiss"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
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

      {/* ═══ TASK CREATE PANEL ═══ */}
      {createPanelOpen && (
        <TaskCreatePanel
          processId={processId}
          asanaProjectGid={asanaProjectGid}
          defaultPdcaSection={createPdcaDefault}
          onCreated={handleTaskCreated}
          onClose={() => setCreatePanelOpen(false)}
        />
      )}

      {/* ═══ TASK DETAIL PANEL ═══ */}
      {selectedTaskId &&
        (() => {
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
              allTasks={tasks}
            />
          );
        })()}

      {/* ═══ LIST VIEW ═══ */}
      {viewMode === 'list' && (
        <TaskListView
          tasks={filteredTasks.filter((t) => t.status !== 'pending' && !t.is_subtask)}
          onToggleComplete={handleToggleComplete}
          togglingTaskIds={togglingTaskIds}
          onCardClick={(t) => setSelectedTaskId(t.id)}
          onDueDateChange={(id, date) =>
            handleUpdateTask(id, { due_date: date || null } as Partial<ProcessTask>)
          }
        />
      )}

      {/* ═══ BOARD VIEW — TASK SECTIONS (with drag-and-drop) ═══ */}
      {viewMode === 'board' && (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {sections.map((section) => {
            const pdca = section.pdcaMatch;
            const borderColor = pdca ? PDCA_SECTIONS[pdca].color : 'var(--border)';
            const taskIds = section.tasks.map((t) => t.id);
            const droppableId = pdca ? `section-${pdca}` : section.key;

            return (
              <DroppableSection
                key={section.key}
                id={droppableId}
                pdca={pdca}
                isDragging={activeDragId !== null}
              >
                {/* Section header */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: `3px solid ${borderColor}` }}
                >
                  <div className="flex items-center gap-2">
                    {/* Select All checkbox for this section */}
                    {taskIds.length > 0 &&
                      (() => {
                        const allSectionSelected = taskIds.every((id) => selectedIds.has(id));
                        const someSectionSelected = taskIds.some((id) => selectedIds.has(id));
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (allSectionSelected) {
                                taskIds.forEach((id) => {
                                  if (selectedIds.has(id)) toggleId(id);
                                });
                              } else {
                                selectAll([...Array.from(selectedIds), ...taskIds]);
                              }
                            }}
                            className={`flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all ${
                              allSectionSelected
                                ? 'border-nia-grey-blue bg-nia-grey-blue'
                                : someSectionSelected
                                  ? 'border-nia-grey-blue/50 bg-nia-grey-blue/20'
                                  : 'border-border hover:border-nia-grey-blue/50'
                            } ${isAnySelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                            aria-label={
                              allSectionSelected
                                ? `Deselect all in ${section.label}`
                                : `Select all in ${section.label}`
                            }
                          >
                            {allSectionSelected && (
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
                            {someSectionSelected && !allSectionSelected && (
                              <span className="w-2 h-0.5 bg-nia-grey-blue rounded-full" />
                            )}
                          </button>
                        );
                      })()}
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: pdca ? PDCA_SECTIONS[pdca].color : undefined }}
                    >
                      {section.label}
                      {pdca === 'plan' && (
                        <HelpTip text="Plan-Do-Check-Act — the continuous improvement cycle. Drag tasks between sections to reclassify." />
                      )}
                      <span className="font-normal text-text-muted ml-2">
                        {section.completedCount}/{section.totalCount} complete
                      </span>
                    </h3>
                  </div>
                  {pdca && (
                    <button
                      onClick={() => {
                        setCreatePdcaDefault(pdca);
                        setCreatePanelOpen(true);
                      }}
                      className="text-xs text-text-muted hover:text-nia-grey-blue transition-colors"
                    >
                      + Add task
                    </button>
                  )}
                </div>

                {/* Task cards (sortable within section) */}
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                  <div className="p-3 space-y-2">
                    {section.tasks.map((task) => {
                      const subtasks = task.asana_task_gid
                        ? sortTasks(
                            allSubtasks.filter((s) => s.parent_asana_gid === task.asana_task_gid)
                          )
                        : [];

                      // Build ordered IDs for shift+click range selection
                      const orderedIds = section.tasks.map((t) => t.id);

                      return (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          subtasks={subtasks}
                          onToggleComplete={handleToggleComplete}
                          isToggling={togglingTaskIds.has(task.id)}
                          onCardClick={(t, e) => {
                            if (e && selectionHandleClick(t, e, orderedIds)) {
                              setSelectedTaskId(t.id);
                            } else if (!e) {
                              setSelectedTaskId(t.id);
                            }
                          }}
                          onDueDateChange={(id, date) =>
                            handleUpdateTask(id, { due_date: date || null } as Partial<ProcessTask>)
                          }
                          hasBlockers={taskBlockerMap.get(task.id) || false}
                          attachmentCount={attachmentCounts.get(task.id) || 0}
                          isSelected={isSelected(task.id)}
                          isAnySelected={isAnySelected}
                          onToggleSelection={toggleId}
                          onContextMenu={selectionHandleContextMenu}
                        />
                      );
                    })}
                    {/* Empty section drop hint */}
                    {section.tasks.length === 0 && activeDragId !== null && (
                      <div className="py-6 text-center text-xs text-text-muted border-2 border-dashed border-border-light rounded-lg">
                        Drop here
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableSection>
            );
          })}

          {/* Drag overlay: semi-transparent preview of the dragged card */}
          <DragOverlay>
            {activeDragId
              ? (() => {
                  const dragTask = tasks.find((t) => t.id === activeDragId);
                  if (!dragTask) return null;
                  return (
                    <div className="opacity-80 shadow-lg rounded-lg">
                      <UnifiedTaskCard task={dragTask} />
                    </div>
                  );
                })()
              : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ═══ CONTEXT MENU ═══ */}
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

      {/* ═══ BULK ACTION TOOLBAR ═══ */}
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

      {/* ═══ BULK DELETE CONFIRMATION ═══ */}
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
    </div>
  );
}

// ── Droppable Section Wrapper ─────────────────────────────────

function DroppableSection({
  id,
  pdca,
  isDragging,
  children,
}: {
  id: string;
  pdca: PdcaSection | null;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const highlightColor = pdca ? PDCA_SECTIONS[pdca].color : 'var(--border)';

  return (
    <div
      ref={setNodeRef}
      className="bg-surface-hover rounded-xl overflow-visible transition-all"
      style={
        isDragging && isOver
          ? { outline: `2px solid ${highlightColor}`, outlineOffset: '2px' }
          : undefined
      }
    >
      {children}
    </div>
  );
}
