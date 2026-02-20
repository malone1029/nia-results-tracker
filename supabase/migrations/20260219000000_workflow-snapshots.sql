-- workflow_snapshots: persisted Mission Workflow Diagram renders
-- Allows the Command Center to load the last generated diagram instantly
-- rather than regenerating on every visit.

CREATE TABLE IF NOT EXISTS workflow_snapshots (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mermaid_code  TEXT         NOT NULL,
  gaps          JSONB        NOT NULL DEFAULT '[]',
  key_count     INT          NOT NULL DEFAULT 0,
  generated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE workflow_snapshots ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read or write snapshots
CREATE POLICY "super_admin_only" ON workflow_snapshots
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE auth_id = auth.uid()
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE auth_id = auth.uid()
        AND role = 'super_admin'
    )
  );
