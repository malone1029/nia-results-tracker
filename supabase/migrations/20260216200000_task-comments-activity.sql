-- Task Power-Up PR 2: Comments and activity log tables

-- Comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES process_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, created_at);

-- Activity log table
CREATE TABLE IF NOT EXISTS task_activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES process_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'completed', 'uncompleted', 'deleted',
    'reassigned', 'priority_changed', 'status_changed', 'commented'
  )),
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity_log(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_user ON task_activity_log(user_id, created_at DESC);
