-- Task Power-Up PR 1: Add priority column to process_tasks
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low'));

CREATE INDEX IF NOT EXISTS idx_process_tasks_priority
  ON process_tasks(process_id, priority);
