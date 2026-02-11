-- Survey Layer 3: Scheduling, targets, and recurring surveys
-- Adds columns to existing surveys + survey_waves tables (no new tables)

-- ============================================================
-- 1. surveys — response target + recurrence config
-- ============================================================
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS response_target INTEGER;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS recurrence_cadence TEXT;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS recurrence_duration_days INTEGER DEFAULT 14;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS recurrence_enabled BOOLEAN DEFAULT false;

-- ============================================================
-- 2. survey_waves — scheduling fields
-- ============================================================
ALTER TABLE survey_waves ADD COLUMN IF NOT EXISTS scheduled_open_at TIMESTAMPTZ;
ALTER TABLE survey_waves ADD COLUMN IF NOT EXISTS scheduled_close_at TIMESTAMPTZ;

-- ============================================================
-- 3. Update status constraint to include 'scheduled'
-- ============================================================
ALTER TABLE survey_waves DROP CONSTRAINT IF EXISTS survey_waves_status_check;
ALTER TABLE survey_waves ADD CONSTRAINT survey_waves_status_check
  CHECK (status IN ('scheduled', 'open', 'closed'));

-- ============================================================
-- 4. Anon can read scheduled waves (for cron visibility)
--    Existing policy already covers this via surveys.is_public
-- ============================================================
-- No new RLS policies needed — authenticated users already have
-- full CRUD on both tables, and scheduled waves use the same
-- survey_id FK that existing policies check.
