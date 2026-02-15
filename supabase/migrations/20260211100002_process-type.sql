-- Migration: Add process_type column to processes table
-- Replaces boolean is_key with explicit Key/Support/Unclassified classification
-- Run in Supabase SQL Editor

-- Add process_type column
ALTER TABLE processes
ADD COLUMN IF NOT EXISTS process_type TEXT NOT NULL DEFAULT 'unclassified';

-- Set ALL processes to unclassified (fresh review, even former is_key = true)
UPDATE processes SET process_type = 'unclassified';

-- Add check constraint for valid values
ALTER TABLE processes
ADD CONSTRAINT process_type_check
CHECK (process_type IN ('key', 'support', 'unclassified'));
