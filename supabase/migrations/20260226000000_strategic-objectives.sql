-- supabase/migrations/20260226000000_strategic-objectives.sql

CREATE TYPE bsc_perspective AS ENUM (
  'financial',
  'org_capacity',
  'internal_process',
  'customer'
);

CREATE TYPE objective_compute_type AS ENUM (
  'metric',
  'adli_threshold',
  'manual'
);

CREATE TABLE strategic_objectives (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  bsc_perspective  bsc_perspective NOT NULL,
  target_value     NUMERIC,
  target_unit      TEXT,
  target_year      INT,
  compute_type     objective_compute_type NOT NULL DEFAULT 'manual',
  linked_metric_id INT REFERENCES metrics(id) ON DELETE SET NULL,
  current_value    NUMERIC,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE process_objectives (
  id           SERIAL PRIMARY KEY,
  process_id   INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  objective_id INT NOT NULL REFERENCES strategic_objectives(id) ON DELETE CASCADE,
  UNIQUE (process_id, objective_id)
);

-- RLS: all authenticated users can read; only service_role can write
ALTER TABLE strategic_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategic_objectives_read" ON strategic_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "process_objectives_read" ON process_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "process_objectives_insert" ON process_objectives
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "process_objectives_delete" ON process_objectives
  FOR DELETE TO authenticated USING (true);
