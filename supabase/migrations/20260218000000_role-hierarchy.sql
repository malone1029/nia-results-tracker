-- Role Hierarchy: member → admin → super_admin
-- super_admin gets all admin powers + exclusive features (role management)

-- 1. Expand CHECK constraint to allow super_admin
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('super_admin', 'admin', 'member'));

-- 2. Promote Jon to super_admin
UPDATE user_roles SET role = 'super_admin'
WHERE email = 'jon.malone@thenia.org';

-- 3. Update is_admin() to include super_admin (used by RLS policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- 4. New is_super_admin() for future super-admin-only features
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE auth_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 5. Update RLS: only super_admin can change roles
DROP POLICY IF EXISTS "Admins can update other user roles" ON user_roles;
CREATE POLICY "Super admins can update other user roles"
  ON user_roles FOR UPDATE
  USING (is_super_admin() AND auth_id != auth.uid())
  WITH CHECK (is_super_admin() AND auth_id != auth.uid());
