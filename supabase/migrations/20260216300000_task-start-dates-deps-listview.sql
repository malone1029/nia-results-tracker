-- Migration: Start dates, task dependencies, list view support
-- PR: start-dates-deps-listview

-- 1. Start date alongside existing due_date
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS start_date DATE;

CREATE INDEX IF NOT EXISTS idx_process_tasks_date_range
  ON process_tasks(start_date, due_date) WHERE start_date IS NOT NULL;

-- 2. Task dependency relationships (Hub-only, not synced to Asana)
CREATE TABLE IF NOT EXISTS task_dependencies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES process_tasks(id) ON DELETE CASCADE,
  depends_on_task_id INTEGER NOT NULL REFERENCES process_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  CONSTRAINT no_self_dependency CHECK (task_id != depends_on_task_id),
  CONSTRAINT unique_dependency UNIQUE (task_id, depends_on_task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON task_dependencies(depends_on_task_id);

-- 3. Add new activity log actions for dependencies
ALTER TABLE task_activity_log
  DROP CONSTRAINT IF EXISTS task_activity_log_action_check;
ALTER TABLE task_activity_log
  ADD CONSTRAINT task_activity_log_action_check CHECK (action IN (
    'created', 'completed', 'uncompleted', 'deleted',
    'reassigned', 'priority_changed', 'status_changed', 'commented',
    'dependency_added', 'dependency_removed'
  ));
