-- supabase/migrations/20260226000002_adoption-rate-metric.sql
-- Creates the Strategic Plan Adoption Rate metric and links it as a BSC objective.
-- The metric is auto-computed monthly by the Strategy page API.

WITH new_metric AS (
  INSERT INTO metrics (
    name,
    description,
    unit,
    cadence,
    target_value,
    is_higher_better,
    data_source,
    next_entry_expected
  )
  VALUES (
    'Strategic Plan Adoption Rate',
    'Percentage of active Hub processes linked to at least one FY26 strategic objective. Auto-computed monthly when the Strategy page loads.',
    '%',
    'monthly',
    80,
    true,
    'Hub — auto-computed',
    date_trunc('month', NOW() + INTERVAL '1 month')::date
  )
  RETURNING id
)
INSERT INTO strategic_objectives (
  title,
  description,
  bsc_perspective,
  target_value,
  target_unit,
  target_year,
  compute_type,
  linked_metric_id,
  sort_order
)
SELECT
  'Strategic plan adoption ≥ 80%',
  'Percentage of active processes in the Hub linked to at least one FY26 strategic objective. Measures how broadly the strategic plan has been integrated into operational work.',
  'internal_process',
  80,
  '%',
  2026,
  'metric',
  id,
  11
FROM new_metric;
