-- Add flow_data JSONB column to workflow_snapshots for React Flow data.
-- Make mermaid_code nullable so new snapshots don't require it.

ALTER TABLE workflow_snapshots
  ADD COLUMN IF NOT EXISTS flow_data JSONB,
  ALTER COLUMN mermaid_code DROP NOT NULL;
