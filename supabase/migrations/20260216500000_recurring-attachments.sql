-- PR 3: Recurring Tasks + Attachments
-- Adds recurrence rules and file attachments to process_tasks

-- 1. Recurrence on tasks
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
  ADD COLUMN IF NOT EXISTS recurring_parent_id INTEGER REFERENCES process_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_process_tasks_recurring
  ON process_tasks(recurring_parent_id) WHERE recurring_parent_id IS NOT NULL;

-- 2. Task attachments (files in Supabase Storage)
CREATE TABLE IF NOT EXISTS task_attachments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES process_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id, created_at);

-- 3. Extend activity log actions
ALTER TABLE task_activity_log
  DROP CONSTRAINT IF EXISTS task_activity_log_action_check;
ALTER TABLE task_activity_log
  ADD CONSTRAINT task_activity_log_action_check CHECK (action IN (
    'created', 'completed', 'uncompleted', 'deleted',
    'reassigned', 'priority_changed', 'status_changed', 'commented',
    'dependency_added', 'dependency_removed',
    'attachment_added', 'attachment_removed', 'recurrence_set'
  ));

-- 4. Create storage bucket for task attachments (if not exists)
-- Note: Supabase Storage buckets are created via the dashboard or API.
-- The bucket "task-attachments" should be created as PRIVATE with a 10MB file size limit.
-- This is documented here as a reminder for deployment.
