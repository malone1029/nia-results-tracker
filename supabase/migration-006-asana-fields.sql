-- Migration 006: Asana integration — token storage + process link fields
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================================
-- 1. User Asana tokens table (one row per user)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_asana_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  asana_user_name TEXT,
  workspace_id TEXT,
  workspace_name TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE user_asana_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own token
CREATE POLICY "Users manage own Asana tokens"
  ON user_asana_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Add Asana link columns to processes table
-- ============================================================

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS asana_project_gid TEXT,
  ADD COLUMN IF NOT EXISTS asana_project_url TEXT;

-- Index for quick lookup by Asana project GID
CREATE INDEX IF NOT EXISTS idx_processes_asana_gid ON processes(asana_project_gid);

-- ============================================================
-- Done! Verify with:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_asana_tokens';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'processes' AND column_name LIKE 'asana%';
-- ============================================================
