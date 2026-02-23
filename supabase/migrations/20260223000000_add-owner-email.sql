-- Add owner_email to processes for reliable email-based ownership matching.
-- The existing owner column (display name) stays for UI display.
-- owner_email is the authoritative link between processes and user_roles.

ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS owner_email TEXT;
