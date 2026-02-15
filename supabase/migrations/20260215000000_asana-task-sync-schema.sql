-- Migration: Asana Task Sync Schema Extension
-- Extends process_tasks to store imported Asana task data alongside Hub-created tasks
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Add new columns to process_tasks                   ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Origin: where the task lives (asana, hub_ai, hub_manual)
-- Distinct from existing `source` which tracks how the task was created
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'hub_ai'
    CHECK (origin IN ('asana', 'hub_ai', 'hub_manual'));

-- Assignee information (from Asana)
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS assignee_name TEXT,
  ADD COLUMN IF NOT EXISTS assignee_email TEXT,
  ADD COLUMN IF NOT EXISTS assignee_asana_gid TEXT;

-- Due date and completion
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Asana section info (which section the task belongs to in Asana)
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS asana_section_name TEXT,
  ADD COLUMN IF NOT EXISTS asana_section_gid TEXT;

-- Subtask hierarchy
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS parent_asana_gid TEXT,
  ADD COLUMN IF NOT EXISTS is_subtask BOOLEAN NOT NULL DEFAULT FALSE;

-- Sync tracking
ALTER TABLE process_tasks
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Update status CHECK constraint                     ║
-- ╚═══════════════════════════════════════════════════════════════╝
-- Add 'active' and 'completed' to the allowed status values

ALTER TABLE process_tasks
  DROP CONSTRAINT IF EXISTS process_tasks_status_check;

ALTER TABLE process_tasks
  ADD CONSTRAINT process_tasks_status_check
    CHECK (status IN ('pending', 'active', 'completed', 'exported'));

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Backfill origin from existing source values         ║
-- ╚═══════════════════════════════════════════════════════════════╝

UPDATE process_tasks
  SET origin = 'hub_manual'
  WHERE source = 'user_created';

-- Rows with source = 'ai_suggestion' or 'ai_interview' keep the default 'hub_ai'

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 4: Add indexes for sync performance                   ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Fast filtering by origin within a process
CREATE INDEX IF NOT EXISTS idx_process_tasks_process_origin
  ON process_tasks(process_id, origin);

-- Fast upsert lookups during Asana sync
CREATE INDEX IF NOT EXISTS idx_process_tasks_asana_task_gid
  ON process_tasks(asana_task_gid)
  WHERE asana_task_gid IS NOT NULL;
