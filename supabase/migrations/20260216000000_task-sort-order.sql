-- Add sort_order column to process_tasks for drag-and-drop reordering.
-- Uses gap-based numbering (x1000) so inserts between items
-- don't require renumbering all rows.

ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill: space by 1000 within each process+section group
UPDATE process_tasks
SET sort_order = sub.rn * 1000
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY process_id, pdca_section
           ORDER BY created_at
         ) AS rn
  FROM process_tasks
) sub
WHERE process_tasks.id = sub.id;

-- Index for efficient section-scoped ordering
CREATE INDEX IF NOT EXISTS idx_process_tasks_sort
  ON process_tasks(process_id, pdca_section, sort_order);
