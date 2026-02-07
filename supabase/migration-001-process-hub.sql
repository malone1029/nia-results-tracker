-- Migration 001: Process Hub - Extend processes table for full documentation
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ============================================================
-- 1. Add new columns to existing processes table
-- ============================================================

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready_for_review', 'in_review', 'revisions_needed', 'approved')),
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'quick'
    CHECK (template_type IN ('quick', 'full')),
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS reviewer text,
  ADD COLUMN IF NOT EXISTS charter jsonb,
  ADD COLUMN IF NOT EXISTS basic_steps jsonb,
  ADD COLUMN IF NOT EXISTS participants jsonb,
  ADD COLUMN IF NOT EXISTS metrics_summary text,
  ADD COLUMN IF NOT EXISTS connections text,
  ADD COLUMN IF NOT EXISTS adli_approach jsonb,
  ADD COLUMN IF NOT EXISTS adli_deployment jsonb,
  ADD COLUMN IF NOT EXISTS adli_learning jsonb,
  ADD COLUMN IF NOT EXISTS adli_integration jsonb,
  ADD COLUMN IF NOT EXISTS workflow jsonb,
  ADD COLUMN IF NOT EXISTS baldrige_connections jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================
-- 2. Create process_requirements junction table
-- ============================================================

CREATE TABLE IF NOT EXISTS process_requirements (
  id serial PRIMARY KEY,
  process_id integer REFERENCES processes(id) ON DELETE CASCADE,
  requirement_id integer REFERENCES key_requirements(id) ON DELETE CASCADE,
  UNIQUE (process_id, requirement_id)
);

-- ============================================================
-- 3. Create process_history table
-- ============================================================

CREATE TABLE IF NOT EXISTS process_history (
  id serial PRIMARY KEY,
  process_id integer REFERENCES processes(id) ON DELETE CASCADE,
  version text,
  change_description text NOT NULL,
  changed_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. Add indexes for common queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_template_type ON processes(template_type);
CREATE INDEX IF NOT EXISTS idx_process_requirements_process_id ON process_requirements(process_id);
CREATE INDEX IF NOT EXISTS idx_process_requirements_requirement_id ON process_requirements(requirement_id);
CREATE INDEX IF NOT EXISTS idx_process_history_process_id ON process_history(process_id);

-- ============================================================
-- 5. RLS policies (matching existing public read/write pattern)
-- ============================================================

-- Processes: add update and delete policies (read/insert already exist)
CREATE POLICY "Allow public update on processes" ON processes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on processes" ON processes FOR DELETE USING (true);

-- Process Requirements
ALTER TABLE process_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on process_requirements" ON process_requirements FOR SELECT USING (true);
CREATE POLICY "Allow public insert on process_requirements" ON process_requirements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on process_requirements" ON process_requirements FOR DELETE USING (true);

-- Process History
ALTER TABLE process_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on process_history" ON process_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on process_history" ON process_history FOR INSERT WITH CHECK (true);

-- ============================================================
-- 6. Auto-tag existing process rows as quick/draft
--    (They already get defaults from the ALTER TABLE above,
--     but this makes it explicit for any rows that existed before)
-- ============================================================

UPDATE processes SET status = 'draft', template_type = 'quick' WHERE status = 'draft';

-- Done! Verify by running: SELECT * FROM processes LIMIT 5;
