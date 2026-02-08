-- Migration 004: Add process_adli_scores table for persistent ADLI maturity tracking
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

CREATE TABLE IF NOT EXISTS process_adli_scores (
  id SERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  approach_score INTEGER NOT NULL CHECK (approach_score BETWEEN 0 AND 100),
  deployment_score INTEGER NOT NULL CHECK (deployment_score BETWEEN 0 AND 100),
  learning_score INTEGER NOT NULL CHECK (learning_score BETWEEN 0 AND 100),
  integration_score INTEGER NOT NULL CHECK (integration_score BETWEEN 0 AND 100),
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  assessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (process_id)
);

-- Allow public read/write (matches existing RLS pattern)
ALTER TABLE process_adli_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to process_adli_scores"
  ON process_adli_scores
  FOR ALL
  USING (true)
  WITH CHECK (true);
