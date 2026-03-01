'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import UnifiedTaskCard from '@/components/unified-task-card';
import type { UnifiedTaskCardProps } from '@/components/unified-task-card';
import type { ProcessTask } from '@/lib/types';

interface SortableTaskCardProps extends UnifiedTaskCardProps {
  /** Subtasks to render beneath this card (not individually draggable) */
  subtasks?: ProcessTask[];
}

export default function SortableTaskCard({
  task,
  subtasks = [],
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
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-stretch gap-0">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="flex-shrink-0 w-6 flex items-center justify-center text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing rounded-l-lg transition-colors"
          aria-label={`Drag to reorder "${task.title}"`}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        {/* Card content */}
        <div className="flex-1 min-w-0">
          <UnifiedTaskCard
            task={task}
            onToggleComplete={onToggleComplete}
            isToggling={isToggling}
            onCardClick={onCardClick}
            onDueDateChange={onDueDateChange}
            hasBlockers={hasBlockers}
            attachmentCount={attachmentCount}
            isSelected={isSelected}
            isAnySelected={isAnySelected}
            onToggleSelection={onToggleSelection}
            onContextMenu={onContextMenu}
          />
        </div>
      </div>

      {/* Subtasks (not draggable — they follow their parent) */}
      {subtasks.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {subtasks.map((sub) => (
            <UnifiedTaskCard
              key={sub.id}
              task={sub}
              isSubtask
              onToggleComplete={onToggleComplete}
              isToggling={isToggling}
              onCardClick={onCardClick}
              onDueDateChange={onDueDateChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
