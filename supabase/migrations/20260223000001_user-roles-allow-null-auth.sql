-- Allow user_roles to be pre-seeded before a person logs in for the first time.
-- Previously auth_id was NOT NULL, so owner-setup inserts failed silently.
-- After this migration:
--   - auth_id is nullable (filled in automatically on first Google OAuth login)
--   - super_admins can insert rows on behalf of future users

-- 1. Drop NOT NULL constraint so pre-seeded rows can have auth_id = null
ALTER TABLE user_roles ALTER COLUMN auth_id DROP NOT NULL;

-- 2. Allow super_admins to insert pre-seeded rows (auth_id will be null until login)
DROP POLICY IF EXISTS "Super admins can insert user_roles" ON user_roles;
CREATE POLICY "Super admins can insert user_roles"
  ON user_roles FOR INSERT
  WITH CHECK (is_super_admin());
