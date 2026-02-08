-- Migration 003: Add process_files table for AI context uploads
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS process_files (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Allow public read/write (matches existing RLS pattern)
ALTER TABLE process_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to process_files"
  ON process_files
  FOR ALL
  USING (true)
  WITH CHECK (true);
