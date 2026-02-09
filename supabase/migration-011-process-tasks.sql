-- Migration 011: Process Tasks (PDCA task queue for Asana export)
-- Run this in the Supabase SQL Editor
-- =============================================================================
-- Stores AI-generated and user-created tasks that map to PDCA sections.
-- Tasks start as "pending" and become "exported" once sent to Asana.

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Create the process_tasks table                     ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS process_tasks (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  process_id     INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,

  -- Task content
  title          TEXT NOT NULL,
  description    TEXT,

  -- PDCA section this task belongs to (Plan, Execute, Evaluate, Improve)
  pdca_section   TEXT NOT NULL CHECK (pdca_section IN ('plan', 'execute', 'evaluate', 'improve')),

  -- Which ADLI dimension this task supports (optional — user-created tasks may not have one)
  adli_dimension TEXT CHECK (adli_dimension IS NULL OR adli_dimension IN ('approach', 'deployment', 'learning', 'integration')),

  -- Where the task came from
  source         TEXT NOT NULL DEFAULT 'ai_suggestion'
                 CHECK (source IN ('ai_suggestion', 'ai_interview', 'user_created')),
  source_detail  TEXT,  -- e.g. "Add quarterly review cadence" (suggestion title)

  -- Export status
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exported')),

  -- Asana link (populated after export)
  asana_task_gid TEXT,
  asana_task_url TEXT,

  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Indexes                                            ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Primary lookup: all tasks for a process
CREATE INDEX IF NOT EXISTS idx_process_tasks_process_id
  ON process_tasks(process_id);

-- Filter by status (pending vs exported) within a process
CREATE INDEX IF NOT EXISTS idx_process_tasks_process_status
  ON process_tasks(process_id, status);

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Row Level Security                                 ║
-- ╚═══════════════════════════════════════════════════════════════╝

ALTER TABLE process_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read process_tasks"
  ON process_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert process_tasks"
  ON process_tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update process_tasks"
  ON process_tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete process_tasks"
  ON process_tasks FOR DELETE
  USING (auth.uid() IS NOT NULL);
