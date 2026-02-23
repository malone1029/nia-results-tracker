-- Add onboarding completion tracking to user_roles
-- Null = not completed. Timestamp = when they finished.

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
