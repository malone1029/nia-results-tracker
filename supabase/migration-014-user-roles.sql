-- Migration 014: User Roles
-- Adds a role system for admin-only features (Phase 3: Baldrige Application Readiness).
-- Admin users see additional pages (Criteria Map, Gap Analysis).
-- Members see no change.

-- ============================================================
-- 1. Create user_roles table
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  auth_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One role per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_auth_id ON user_roles(auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);

-- ============================================================
-- 2. RLS: users can only read their own role
-- ============================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = auth_id);

-- Only postgres/service role can insert/update roles (not app users)
-- Admin seeding is done via SQL Editor, not the app

-- ============================================================
-- 3. Seed Jon as admin
-- ============================================================
-- This uses a subquery to look up Jon's auth.users id by email.
-- If Jon hasn't signed up yet, run this again after first login.
INSERT INTO user_roles (auth_id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'jon.malone@thenia.org'
ON CONFLICT (email) DO UPDATE SET role = 'admin';
