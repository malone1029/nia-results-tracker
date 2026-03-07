-- Expand improvement_journal status options for Process Improvement module
-- Adds: under_review (evaluation phase), dismissed (decided not to pursue)

ALTER TABLE improvement_journal
  DROP CONSTRAINT improvement_journal_status_check;

ALTER TABLE improvement_journal
  ADD CONSTRAINT improvement_journal_status_check
    CHECK (status IN ('suggested', 'under_review', 'in_progress', 'completed', 'dismissed'));

-- Track the Resolve ticket so the Hub can link back
ALTER TABLE improvement_journal
  ADD COLUMN IF NOT EXISTS resolve_ticket_url text;
