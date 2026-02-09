-- Migration 010: Multi-Process Metrics (many-to-many junction table)
-- Run this in the Supabase SQL Editor
-- =============================================================================
-- Converts metrics → processes from one-to-many (FK column) to many-to-many
-- (junction table), so a single metric can be linked to multiple processes.

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Create the junction table                          ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS metric_processes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_id INT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  process_id INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  UNIQUE (metric_id, process_id)
);

CREATE INDEX IF NOT EXISTS idx_metric_processes_metric_id
  ON metric_processes(metric_id);

CREATE INDEX IF NOT EXISTS idx_metric_processes_process_id
  ON metric_processes(process_id);

-- RLS: authenticated access only (matches all other tables)
ALTER TABLE metric_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read metric_processes"
  ON metric_processes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert metric_processes"
  ON metric_processes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update metric_processes"
  ON metric_processes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete metric_processes"
  ON metric_processes FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Migrate existing data into the junction table      ║
-- ╚═══════════════════════════════════════════════════════════════╝

INSERT INTO metric_processes (metric_id, process_id)
SELECT id, process_id
FROM metrics
WHERE process_id IS NOT NULL
ON CONFLICT (metric_id, process_id) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Drop the old column and its index                  ║
-- ╚═══════════════════════════════════════════════════════════════╝

DROP INDEX IF EXISTS idx_metrics_process_id;
ALTER TABLE metrics DROP COLUMN IF EXISTS process_id;
