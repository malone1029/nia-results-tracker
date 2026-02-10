-- Migration 013: Readiness Snapshots
-- Stores periodic snapshots of org readiness scores for trend tracking.

CREATE TABLE readiness_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  org_score INTEGER NOT NULL,            -- 0-100 weighted org readiness score
  category_scores JSONB NOT NULL,         -- { "cat_id": score, ... }
  dimension_scores JSONB NOT NULL,        -- { "documentation": pct, "maturity": pct, ... }
  process_count INTEGER NOT NULL DEFAULT 0,
  ready_count INTEGER NOT NULL DEFAULT 0, -- count at 80+
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one snapshot per date
CREATE UNIQUE INDEX idx_readiness_snapshots_date ON readiness_snapshots(snapshot_date);

-- RLS: require authenticated user
ALTER TABLE readiness_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON readiness_snapshots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert snapshots"
  ON readiness_snapshots FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
