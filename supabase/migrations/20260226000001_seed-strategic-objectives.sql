-- supabase/migrations/20260226000001_seed-strategic-objectives.sql

INSERT INTO strategic_objectives
  (title, description, bsc_perspective, target_value, target_unit, target_year, compute_type, linked_metric_id, current_value, sort_order)
VALUES
  -- Financial
  ('FY25 budget surplus',
   'Finish FY25 with a 1–3% budget surplus. Status: Not Met.',
   'financial', 3, '%', 2025, 'manual', NULL, NULL, 1),

  ('FY26 budget surplus',
   'Finish FY26 with a 1–3% budget surplus.',
   'financial', 3, '%', 2026, 'manual', NULL, NULL, 2),

  ('FY27 budget surplus',
   'Finish FY27 with a 1–3% budget surplus.',
   'financial', 3, '%', 2027, 'manual', NULL, NULL, 3),

  -- Organizational Capacity
  ('Train 50 teammates in PDCA/Quality',
   'Provide training in Quality and Process Improvement for 50 teammates during FY26.',
   'org_capacity', 50, 'teammates', 2026, 'manual', NULL, NULL, 4),

  ('Teammate retention',
   'Retain a target percentage of teammates year over year. Target TBD pending baseline data.',
   'org_capacity', NULL, '%', 2026, 'manual', NULL, NULL, 5),

  ('BST satisfaction ≥ 4.5',
   'Maintain internal satisfaction with Business Services Departments at 4.5 or higher (Studer BSS Survey Overall Mean).',
   'org_capacity', 4.5, 'score', 2026, 'metric', 265, NULL, 6),

  ('Employee engagement ≥ 4.5',
   'Maintain Employee Engagement at 4.5 or higher (Studer EE Survey Overall Mean).',
   'org_capacity', 4.5, 'score', 2026, 'metric', 199, NULL, 7),

  -- Internal Process
  ('20 processes with ADLI ≥ 70',
   'Demonstrate process maturity by achieving an ADLI overall score of 70 or higher in 20 or more NIA processes as assessed through the Excellence Hub by June 2026.',
   'internal_process', 20, 'processes', 2026, 'adli_threshold', NULL, NULL, 8),

  -- Customer
  ('Maintain/increase active customers',
   'Maintain or increase active purchasing customers from the previous fiscal year.',
   'customer', NULL, 'customers', 2026, 'manual', NULL, NULL, 9),

  ('Customer satisfaction ≥ 4.5',
   'Maintain Customer Satisfaction at 4.5 or higher (Studer MDS Survey Overall Mean).',
   'customer', 4.5, 'score', 2026, 'metric', 258, NULL, 10);
