-- Migration 018: Add tier column to baldrige_questions
-- Distinguishes Excellence Builder questions from full framework questions.
-- EB questions are the simpler "key questions" used for the 25-page application.
-- Full framework questions are the detailed questions used for the 50-page application.

-- Add the tier column with a default of 'full' so existing questions keep their tier
ALTER TABLE baldrige_questions
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'full';

-- Add check constraint (wrapped in DO block for idempotency)
DO $$ BEGIN
  ALTER TABLE baldrige_questions
    ADD CONSTRAINT baldrige_questions_tier_check
    CHECK (tier IN ('excellence_builder', 'full'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
