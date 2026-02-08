-- Migration 007: AI Overhaul — One Template, Improvement History, Asana Raw Data
-- Run this in the Supabase SQL Editor
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  LAYER 1: Drop the Quick Template                           ║
-- ║  Migrate quick-only data into charter.content as markdown   ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Step 1: Migrate quick-only data into charter for any "quick" processes
-- that have content in basic_steps, participants, metrics_summary, or connections
-- but don't yet have a charter.
UPDATE processes
SET charter = jsonb_build_object(
  'content',
  concat_ws(E'\n\n',
    -- Description
    CASE WHEN description IS NOT NULL AND description != ''
      THEN concat('## Overview', E'\n\n', description)
      ELSE NULL
    END,
    -- Basic steps
    CASE WHEN basic_steps IS NOT NULL AND jsonb_array_length(basic_steps) > 0
      THEN concat('## How We Do It', E'\n\n',
        (SELECT string_agg(
          concat(ordinality::text, '. ', elem::text),
          E'\n' ORDER BY ordinality
        ) FROM jsonb_array_elements_text(basic_steps) WITH ORDINALITY AS t(elem, ordinality)))
      ELSE NULL
    END,
    -- Participants
    CASE WHEN participants IS NOT NULL AND jsonb_array_length(participants) > 0
      THEN concat('## Who''s Involved', E'\n\n',
        (SELECT string_agg(concat('- ', elem::text), E'\n')
         FROM jsonb_array_elements_text(participants) AS elem))
      ELSE NULL
    END,
    -- Metrics summary
    CASE WHEN metrics_summary IS NOT NULL AND metrics_summary != ''
      THEN concat('## How We Know It''s Working', E'\n\n', metrics_summary)
      ELSE NULL
    END,
    -- Connections
    CASE WHEN connections IS NOT NULL AND connections != ''
      THEN concat('## What This Connects To', E'\n\n', connections)
      ELSE NULL
    END
  )
)
WHERE template_type = 'quick'
  AND (charter IS NULL OR charter = '{}'::jsonb)
  AND (
    (basic_steps IS NOT NULL AND jsonb_array_length(basic_steps) > 0)
    OR (participants IS NOT NULL AND jsonb_array_length(participants) > 0)
    OR (metrics_summary IS NOT NULL AND metrics_summary != '')
    OR (connections IS NOT NULL AND connections != '')
  );

-- Step 1b: For quick processes that already have a charter, append quick data
-- to the existing charter.content
UPDATE processes
SET charter = jsonb_set(
  COALESCE(charter, '{}'::jsonb),
  '{content}',
  to_jsonb(
    concat_ws(E'\n\n',
      COALESCE(charter->>'content', ''),
      CASE WHEN basic_steps IS NOT NULL AND jsonb_array_length(basic_steps) > 0
        THEN concat('## How We Do It', E'\n\n',
          (SELECT string_agg(
            concat(ordinality::text, '. ', elem::text),
            E'\n' ORDER BY ordinality
          ) FROM jsonb_array_elements_text(basic_steps) WITH ORDINALITY AS t(elem, ordinality)))
        ELSE NULL
      END,
      CASE WHEN participants IS NOT NULL AND jsonb_array_length(participants) > 0
        THEN concat('## Who''s Involved', E'\n\n',
          (SELECT string_agg(concat('- ', elem::text), E'\n')
           FROM jsonb_array_elements_text(participants) AS elem))
        ELSE NULL
      END,
      CASE WHEN metrics_summary IS NOT NULL AND metrics_summary != ''
        THEN concat('## How We Know It''s Working', E'\n\n', metrics_summary)
        ELSE NULL
      END,
      CASE WHEN connections IS NOT NULL AND connections != ''
        THEN concat('## What This Connects To', E'\n\n', connections)
        ELSE NULL
      END
    )
  )
)
WHERE template_type = 'quick'
  AND charter IS NOT NULL
  AND charter != '{}'::jsonb
  AND (
    (basic_steps IS NOT NULL AND jsonb_array_length(basic_steps) > 0)
    OR (participants IS NOT NULL AND jsonb_array_length(participants) > 0)
    OR (metrics_summary IS NOT NULL AND metrics_summary != '')
    OR (connections IS NOT NULL AND connections != '')
  );

-- Step 2: Set all rows to 'full'
UPDATE processes SET template_type = 'full';

-- Step 3: Drop the template_type index (it's no longer useful)
DROP INDEX IF EXISTS idx_processes_template_type;

-- Step 4: Remove the CHECK constraint on template_type
-- (Keep the column for rollback safety — can be dropped in a future migration)
ALTER TABLE processes DROP CONSTRAINT IF EXISTS processes_template_type_check;

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  LAYER 2: Improvement History Table                         ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS process_improvements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  process_id INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,

  -- What changed
  section_affected TEXT NOT NULL CHECK (section_affected IN (
    'approach', 'deployment', 'learning', 'integration', 'charter', 'workflow'
  )),
  change_type TEXT NOT NULL DEFAULT 'modification' CHECK (change_type IN (
    'addition', 'modification', 'removal'
  )),
  title TEXT NOT NULL,
  description TEXT,

  -- What triggered it
  trigger TEXT CHECK (trigger IN (
    'ai_suggestion', 'user_initiated', 'review_finding', 'import'
  )),
  trigger_detail TEXT,

  -- Before/after snapshots
  before_snapshot JSONB,
  after_snapshot JSONB,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN (
    'committed', 'in_progress', 'implemented', 'deferred', 'cancelled'
  )),
  committed_by TEXT,
  committed_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  implemented_date TIMESTAMPTZ,

  -- Impact tracking
  impact_assessed BOOLEAN DEFAULT FALSE,
  impact_assessment_date TIMESTAMPTZ,
  impact_notes TEXT,

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'user_initiated' CHECK (source IN (
    'ai_suggestion', 'user_initiated', 'review_finding', 'import'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching improvements by process
CREATE INDEX IF NOT EXISTS idx_process_improvements_process_id
  ON process_improvements(process_id);

-- RLS: authenticated access only (matches other tables)
ALTER TABLE process_improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read improvements"
  ON process_improvements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert improvements"
  ON process_improvements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update improvements"
  ON process_improvements FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete improvements"
  ON process_improvements FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  LAYER 4: Asana Raw Data Column                             ║
-- ╚═══════════════════════════════════════════════════════════════╝

ALTER TABLE processes ADD COLUMN IF NOT EXISTS asana_raw_data JSONB;
