-- Add data_steward_email to metrics for accountability and reporting.
-- Nullable: not all metrics need a steward assigned immediately.

ALTER TABLE metrics ADD COLUMN IF NOT EXISTS data_steward_email TEXT;
