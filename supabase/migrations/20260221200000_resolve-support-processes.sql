-- Migration: Resolve Support Processes + Metrics
-- Seeds 2 processes (Technology Support + HR Support) and 4 metrics
-- that are automatically synced monthly from the Resolve help desk system.

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_name ON metrics (name);

DO $$
DECLARE
  v_ops_category_id    INTEGER;
  v_workforce_cat_id   INTEGER;
  v_tech_process_id    INTEGER;
  v_hr_process_id      INTEGER;
  v_metric_id          INTEGER;
BEGIN

  -- Category 6: Operations (Technology Support lives here — Baldrige 6.2)
  SELECT id INTO v_ops_category_id FROM categories WHERE name ILIKE '%Operation%' LIMIT 1;
  IF v_ops_category_id IS NULL THEN v_ops_category_id := 6; END IF;

  -- Category 5: Workforce (HR Support lives here — Baldrige 5.2)
  SELECT id INTO v_workforce_cat_id FROM categories WHERE name ILIKE '%Workforce%' LIMIT 1;
  IF v_workforce_cat_id IS NULL THEN v_workforce_cat_id := 5; END IF;

  -- ── Process: Technology Support ──
  SELECT id INTO v_tech_process_id FROM processes WHERE name = 'Technology Support' LIMIT 1;
  IF v_tech_process_id IS NULL THEN
    INSERT INTO processes (name, description, category_id, owner, process_type, status)
    VALUES (
      'Technology Support',
      'Internal IT help desk for hardware, software, systems, and technology requests. Metrics auto-synced from Resolve.',
      v_ops_category_id,
      'Technology Department',
      'key',
      'draft'
    )
    RETURNING id INTO v_tech_process_id;
  END IF;

  -- ── Process: HR Support ──
  SELECT id INTO v_hr_process_id FROM processes WHERE name = 'HR Support' LIMIT 1;
  IF v_hr_process_id IS NULL THEN
    INSERT INTO processes (name, description, category_id, owner, process_type, status)
    VALUES (
      'HR Support',
      'Internal HR help desk for benefits, policies, personnel questions, and workforce requests. Metrics auto-synced from Resolve.',
      v_workforce_cat_id,
      'Human Resources Department',
      'key',
      'draft'
    )
    RETURNING id INTO v_hr_process_id;
  END IF;

  -- ── Metric 1: Technology Avg Resolution Time ──
  -- Lower is better (faster = better service)
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES (
    'Technology Support: Avg Resolution Time',
    'hours',
    'monthly',
    24.0,
    false,
    'Resolve Help Desk',
    'Auto-synced monthly from Resolve'
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'Technology Support: Avg Resolution Time';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_tech_process_id) ON CONFLICT DO NOTHING;

  -- ── Metric 2: Technology Customer Satisfaction ──
  -- Higher is better (5/5 = best)
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES (
    'Technology Support: Customer Satisfaction',
    'rating',
    'monthly',
    4.5,
    true,
    'Resolve Help Desk',
    'Auto-synced monthly from Resolve'
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'Technology Support: Customer Satisfaction';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_tech_process_id) ON CONFLICT DO NOTHING;

  -- ── Metric 3: HR Avg Resolution Time ──
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES (
    'HR Support: Avg Resolution Time',
    'hours',
    'monthly',
    24.0,
    false,
    'Resolve Help Desk',
    'Auto-synced monthly from Resolve'
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'HR Support: Avg Resolution Time';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_hr_process_id) ON CONFLICT DO NOTHING;

  -- ── Metric 4: HR Customer Satisfaction ──
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES (
    'HR Support: Customer Satisfaction',
    'rating',
    'monthly',
    4.5,
    true,
    'Resolve Help Desk',
    'Auto-synced monthly from Resolve'
  )
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'HR Support: Customer Satisfaction';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_hr_process_id) ON CONFLICT DO NOTHING;

END $$;
