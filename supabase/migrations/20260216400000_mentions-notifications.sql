-- Migration: Notification preferences and @mentions
-- PR: mentions-notifications

-- 1. Notification preferences per user (defaults all ON)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  notify_on_assignment BOOLEAN NOT NULL DEFAULT true,
  notify_on_due_approaching BOOLEAN NOT NULL DEFAULT true,
  notify_on_completion BOOLEAN NOT NULL DEFAULT true,
  notify_on_mention BOOLEAN NOT NULL DEFAULT true,
  notify_weekly_digest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Track mentions for notification delivery
CREATE TABLE IF NOT EXISTS task_mentions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES process_tasks(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  mentioned_user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_mentions_user ON task_mentions(mentioned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_mentions_comment ON task_mentions(comment_id);
