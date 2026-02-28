-- Add 'suggested' status for entries created from Resolve help desk tickets.
-- Also add source tracking columns to link back to the originating ticket.

ALTER TABLE improvement_journal
  DROP CONSTRAINT improvement_journal_status_check;

ALTER TABLE improvement_journal
  ADD CONSTRAINT improvement_journal_status_check
    CHECK (status IN ('suggested', 'in_progress', 'completed'));

ALTER TABLE improvement_journal
  ADD COLUMN IF NOT EXISTS source_ticket_id uuid,
  ADD COLUMN IF NOT EXISTS source_ticket_number integer,
  ADD COLUMN IF NOT EXISTS submitted_by text;
