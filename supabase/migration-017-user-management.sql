-- Migration 017: User Management
-- Extends user_roles table with full_name and last_login_at for the admin panel.
-- Adds RLS policies so admins can see all users and update roles (except their own).
-- NOTE: Uses is_admin() SECURITY DEFINER function to avoid infinite recursion.

-- ============================================================
-- 1. Add columns to user_roles
-- ============================================================
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows with name from auth.users metadata
UPDATE user_roles
SET full_name = u.raw_user_meta_data ->> 'full_name',
    last_login_at = COALESCE(u.last_sign_in_at, user_roles.created_at)
FROM auth.users u
WHERE user_roles.auth_id = u.id
  AND user_roles.full_name IS NULL;

-- ============================================================
-- 2. SECURITY DEFINER function to check admin status
--    Runs as postgres role, bypassing RLS (avoids infinite recursion).
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 3. RLS: Admins can read ALL rows
-- ============================================================
CREATE POLICY "Admins can read all user_roles"
  ON user_roles FOR SELECT
  USING (is_admin());

-- ============================================================
-- 4. RLS: Admins can update other users' roles (not their own)
-- ============================================================
CREATE POLICY "Admins can update other user roles"
  ON user_roles FOR UPDATE
  USING (
    is_admin()
    AND auth_id != auth.uid()
  )
  WITH CHECK (
    is_admin()
    AND auth_id != auth.uid()
  );

-- ============================================================
-- 5. RLS: Allow upsert from auth callback (users can insert/update own row)
-- ============================================================
CREATE POLICY "Users can upsert own user_roles row"
  ON user_roles FOR INSERT
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Users can update own user_roles metadata"
  ON user_roles FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());
