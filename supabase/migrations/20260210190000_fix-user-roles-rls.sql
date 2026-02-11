-- Fix: user_roles RLS infinite recursion
-- The admin policies on user_roles referenced user_roles itself, causing infinite recursion.
-- Fix: use a SECURITY DEFINER function that bypasses RLS for the admin check.

-- ============================================================
-- 1. Drop the broken policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can read all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update other user roles" ON user_roles;

-- ============================================================
-- 2. Create a SECURITY DEFINER function to check admin status
--    This runs as the function owner (postgres), bypassing RLS.
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
-- 3. Recreate policies using the function (no self-reference)
-- ============================================================
CREATE POLICY "Admins can read all user_roles"
  ON user_roles FOR SELECT
  USING (is_admin());

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
