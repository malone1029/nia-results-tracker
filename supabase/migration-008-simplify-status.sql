-- Migration 008: Simplify process status workflow
-- Old: draft → ready_for_review → in_review → revisions_needed → approved
-- New: draft → ready_for_review → approved

-- Step 1: Move existing rows off removed statuses
UPDATE processes SET status = 'ready_for_review' WHERE status IN ('in_review', 'revisions_needed');

-- Step 2: Drop old CHECK constraint and add new one
ALTER TABLE processes DROP CONSTRAINT IF EXISTS processes_status_check;
ALTER TABLE processes ADD CONSTRAINT processes_status_check
  CHECK (status IN ('draft', 'ready_for_review', 'approved'));
