'use client';

import { useState, useCallback, useRef } from 'react';
import type { ProcessTask } from '@/lib/types';
import type { ContextMenuPosition } from '@/components/task-context-menu';

interface UseTaskSelectionReturn {
  /** Set of currently selected task IDs */
  selectedIds: Set<number>;
  /** True when at least one task is selected (drives checkbox visibility) */
  isAnySelected: boolean;
  /** Check if a specific task is selected */
  isSelected: (taskId: number) => boolean;
  /** Toggle a single task's selection (for checkbox clicks — no modifier key needed) */
  toggleId: (taskId: number) => void;
  /**
   * Handle a click on a task card/row.
   * - Plain click → clear selection, return true (caller should open detail panel)
   * - Cmd/Ctrl+click → toggle task in/out of selection, return false
   * - Shift+click → select range, return false
   */
  handleTaskClick: (task: ProcessTask, e: React.MouseEvent, orderedIds: number[]) => boolean;
  /** Handle right-click on a task card/row */
  handleContextMenu: (task: ProcessTask, e: React.MouseEvent) => void;
  /** Current context menu state (null when closed) */
  contextMenu: ContextMenuPosition | null;
  /** Close the context menu */
  closeContextMenu: () => void;
  /** Select all tasks from a given list */
  selectAll: (taskIds: number[]) => void;
  /** Clear all selection */
  clearSelection: () => void;
}

export function useTaskSelection(): UseTaskSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const lastSelectedIdRef = useRef<number | null>(null);

  const isAnySelected = selectedIds.size > 0;

  const isSelected = useCallback((taskId: number) => selectedIds.has(taskId), [selectedIds]);

  const toggleId = useCallback((taskId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
    lastSelectedIdRef.current = taskId;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  const selectAll = useCallback((taskIds: number[]) => {
    setSelectedIds(new Set(taskIds));
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleTaskClick = useCallback(
    (task: ProcessTask, e: React.MouseEvent, orderedIds: number[]): boolean => {
      const isModifier = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      if (isModifier) {
        // Cmd/Ctrl+click: toggle individual task
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(task.id)) {
            next.delete(task.id);
          } else {
            next.add(task.id);
          }
          return next;
        });
        lastSelectedIdRef.current = task.id;
        return false; // Don't open detail panel
      }

      if (isShift && lastSelectedIdRef.current !== null) {
        // Shift+click: select range
        const lastIdx = orderedIds.indexOf(lastSelectedIdRef.current);
        const currentIdx = orderedIds.indexOf(task.id);

        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          const rangeIds = orderedIds.slice(start, end + 1);

          setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of rangeIds) {
              next.add(id);
            }
            return next;
          });
        }
        return false; // Don't open detail panel
      }

      // Plain click: clear selection, open detail panel
      if (selectedIds.size > 0) {
        clearSelection();
        return false; // If there was a selection, just clear it — don't open panel
      }

      return true; // No selection active — open detail panel as usual
    },
    [selectedIds, clearSelection]
  );

  const handleContextMenu = useCallback(
    (task: ProcessTask, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (selectedIds.has(task.id)) {
        // Right-clicked a selected task: keep the multi-selection
        setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id });
      } else {
        // Right-clicked an unselected task: select only that task
        setSelectedIds(new Set([task.id]));
        lastSelectedIdRef.current = task.id;
        setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id });
      }
    },
    [selectedIds]
  );

  return {
    selectedIds,
    isAnySelected,
    isSelected,
    toggleId,
    handleTaskClick,
    handleContextMenu,
    contextMenu,
    closeContextMenu,
    selectAll,
    clearSelection,
  };
}
