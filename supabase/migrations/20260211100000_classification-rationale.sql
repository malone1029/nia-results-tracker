-- Add classification_rationale column to processes table
-- Stores the AI's reasoning for Key vs Support classification
ALTER TABLE processes ADD COLUMN IF NOT EXISTS classification_rationale TEXT;
