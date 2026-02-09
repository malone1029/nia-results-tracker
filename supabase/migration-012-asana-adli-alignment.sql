-- Migration 012: Asana-Hub Data Alignment
-- Adds columns for ADLI task GID tracking, raw data snapshots, and guided flow state.

-- Previous raw data snapshot (AI compares old vs new to detect progress)
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS asana_raw_data_previous JSONB;

-- Stores Asana GIDs for the 4 ADLI documentation tasks:
-- {"approach": "gid", "deployment": "gid", "learning": "gid", "integration": "gid"}
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS asana_adli_task_gids JSONB DEFAULT '{}';

-- Tracks position in the guided improvement flow
-- Values: start, charter, assessment, deep_dive, tasks, export, complete
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS guided_step TEXT DEFAULT 'start';
