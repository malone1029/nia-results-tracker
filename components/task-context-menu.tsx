'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ProcessTask, TaskPriority } from '@/lib/types';

// ── Menu item types ──────────────────────────────────────────

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuPosition {
  x: number;
  y: number;
  taskId: number;
}

// ── Menu item factories ──────────────────────────────────────

/** Actions for a single right-clicked task */
export function getSingleTaskMenuItems(task: ProcessTask): ContextMenuItem[] {
  return [
    {
      id: task.completed ? 'uncomplete' : 'complete',
      label: task.completed ? 'Mark Incomplete' : 'Mark Complete',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      id: 'set-priority',
      label: 'Set Priority',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
      ),
      submenu: [
        { id: 'priority-high', label: 'High' },
        { id: 'priority-medium', label: 'Medium' },
        { id: 'priority-low', label: 'Low' },
      ],
    },
    {
      id: 'assign',
      label: 'Assign...',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      id: 'set-due-date',
      label: 'Set Due Date...',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    ...(task.asana_task_url
      ? [
          {
            id: 'open-in-asana',
            label: 'Open in Asana',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            ),
          },
        ]
      : []),
    {
      id: 'delete',
      label: 'Delete',
      danger: true,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
    },
  ];
}

/** Actions for a multi-selected group */
export function getBulkTaskMenuItems(count: number): ContextMenuItem[] {
  return [
    {
      id: 'bulk-complete',
      label: `Complete ${count} tasks`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      id: 'bulk-set-priority',
      label: `Set priority for ${count} tasks`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
      ),
      submenu: [
        { id: 'bulk-priority-high', label: 'High' },
        { id: 'bulk-priority-medium', label: 'Medium' },
        { id: 'bulk-priority-low', label: 'Low' },
      ],
    },
    {
      id: 'bulk-assign',
      label: `Assign ${count} tasks`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      id: 'bulk-set-due-date',
      label: `Set due date for ${count} tasks`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: 'bulk-delete',
      label: `Delete ${count} tasks`,
      danger: true,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
    },
  ];
}

// ── Context Menu Component ───────────────────────────────────

interface TaskContextMenuProps {
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export default function TaskContextMenu({
  position,
  items,
  onAction,
  onClose,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const focusIndex = useRef(0);
  const openSubmenuId = useRef<string | null>(null);

  // Position clamping to viewport edges
  const clampedPosition = useCallback(() => {
    const menuWidth = 220;
    const menuHeight = items.length * 36 + 16; // approx
    const padding = 8;

    let x = position.x;
    let y = position.y;

    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }
    if (x < padding) x = padding;
    if (y < padding) y = padding;

    return { x, y };
  }, [position, items.length]);

  // Close on click-outside, Escape, scroll, resize
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      const focusableItems = items.filter((i) => !i.disabled);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusIndex.current = (focusIndex.current + 1) % focusableItems.length;
        focusCurrentItem();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusIndex.current =
          (focusIndex.current - 1 + focusableItems.length) % focusableItems.length;
        focusCurrentItem();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = focusableItems[focusIndex.current];
        if (item && !item.submenu) {
          onAction(item.id);
        }
      }
    }
    function handleScroll() {
      onClose();
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose, onAction, items]);

  // Focus the first item on mount
  useEffect(() => {
    focusIndex.current = 0;
    focusCurrentItem();
  }, []);

  function focusCurrentItem() {
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (buttons && buttons[focusIndex.current]) {
      buttons[focusIndex.current].focus();
    }
  }

  const pos = clampedPosition();

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Task actions"
      className="fixed z-[200] bg-card border border-border rounded-lg shadow-lg py-1 animate-context-menu min-w-[200px]"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item) => (
        <div key={item.id} className="relative group/menuitem">
          <button
            role="menuitem"
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.submenu) {
                openSubmenuId.current = openSubmenuId.current === item.id ? null : item.id;
                // Force re-render by toggling state — but we use a simpler approach:
                // The submenu is always visible on hover via CSS
                return;
              }
              onAction(item.id);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
              item.danger
                ? 'text-nia-red hover:bg-nia-red/10'
                : 'text-foreground hover:bg-surface-hover'
            } ${item.disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
          >
            {item.icon && (
              <span className={`flex-shrink-0 ${item.danger ? 'text-nia-red' : 'text-text-muted'}`}>
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.submenu && (
              <svg
                className="w-3 h-3 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </button>

          {/* Submenu */}
          {item.submenu && (
            <div className="absolute left-full top-0 ml-0.5 hidden group-hover/menuitem:block">
              <div className="bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] animate-context-menu">
                {item.submenu.map((sub) => (
                  <button
                    key={sub.id}
                    role="menuitem"
                    type="button"
                    onClick={() => onAction(sub.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover text-left cursor-pointer"
                  >
                    {sub.id.includes('high') && (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                    {sub.id.includes('medium') && (
                      <span className="w-2 h-2 rounded-full bg-nia-orange" />
                    )}
                    {sub.id.includes('low') && (
                      <span className="w-2 h-2 rounded-full bg-surface-muted" />
                    )}
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
