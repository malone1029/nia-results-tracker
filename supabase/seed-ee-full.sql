-- EE (Employee Experience) Full Survey Metrics
-- Source: Employee Experience Survey Fall 2025 Results Report (Studer Education)
-- Data: 3 administrations (Fall 2024, Spring 2025, Fall 2025)
-- Skipping: Leader-level breakdowns (Tables 5-8) per user request
-- Run in Supabase SQL Editor

-- Ensure unique constraints exist for idempotent inserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_name ON metrics (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_processes_unique ON metric_processes (metric_id, process_id);

DO $$
DECLARE
  v_process_id INTEGER;
  v_metric_id INTEGER;
  v_cat_id INTEGER;
BEGIN

-- Find Employee Experience process (create if missing)
SELECT id INTO v_process_id FROM processes WHERE name ILIKE '%Employee Experience%' LIMIT 1;
IF v_process_id IS NULL THEN
  SELECT id INTO v_cat_id FROM categories WHERE name ILIKE '%Workforce%' LIMIT 1;
  IF v_cat_id IS NULL THEN v_cat_id := 1; END IF;
  INSERT INTO processes (name, description, category_id, owner, process_type)
  VALUES ('Employee Experience', 'Employee engagement and satisfaction survey process', v_cat_id, 'Jon Malone', 'key')
  RETURNING id INTO v_process_id;
END IF;

-- ============================================================
-- TABLE 1: Overall Stats (3 administrations)
-- ============================================================

-- EE Participation
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Participation', 'count', 'semi-annual', NULL, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Participation';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 216, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 228, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 227, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- EE Overall Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Overall Mean', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.62, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.63, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.61, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- EE Overall Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Overall Top Box %', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Overall Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 69.79, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 70.25, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 72.08, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- EE Overall Top 2 Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Overall Top 2 Box %', 'percentage', 'semi-annual', 90.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Overall Top 2 Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 93.44, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 94.00, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 94.04, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 2A: Organization NPS (3 administrations)
-- ============================================================

-- EE Org NPS
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Org NPS', 'score', 'semi-annual', 70.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Org NPS';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 68.98, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 70.61, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 76.99, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- EE Org Promoter %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Org Promoter %', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Org Promoter %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 73.61, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 73.68, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 79.65, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- EE Org Passive %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Org Passive %', 'percentage', 'semi-annual', NULL, false, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Org Passive %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 21.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 23.25, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 17.70, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- EE Org Detractor %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Org Detractor %', 'percentage', 'semi-annual', NULL, false, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Org Detractor %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.63, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 3.07, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 2.65, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 2B: Work Area NPS (Fall 2025 only — new question)
-- ============================================================

-- EE Work Area NPS
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Work Area NPS', 'score', 'semi-annual', 70.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Work Area NPS';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 66.81, '2025-11-01', 'Fall 2025 — new question')
ON CONFLICT DO NOTHING;

-- EE Work Area Promoter %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Work Area Promoter %', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Work Area Promoter %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 72.12, '2025-11-01', 'Fall 2025 — new question')
ON CONFLICT DO NOTHING;

-- EE Work Area Passive %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Work Area Passive %', 'percentage', 'semi-annual', NULL, false, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Work Area Passive %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 22.57, '2025-11-01', 'Fall 2025 — new question')
ON CONFLICT DO NOTHING;

-- EE Work Area Detractor %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Work Area Detractor %', 'percentage', 'semi-annual', NULL, false, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Work Area Detractor %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 5.31, '2025-11-01', 'Fall 2025 — new question')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 3: Item Means by Survey Administration (20 items x 3 admin)
-- Verbatim question text from Studer Education EE Survey
-- ============================================================

-- Q1: I feel supported with good processes and the appropriate resources to do my job.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q1 Mean: I feel supported with good processes and the appropriate resources to do my job.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q1 Mean: I feel supported with good processes and the appropriate resources to do my job.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.62, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.68, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.62, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q2: I receive feedback on my strengths as an employee.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q2 Mean: I receive feedback on my strengths as an employee.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q2 Mean: I receive feedback on my strengths as an employee.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.55, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.64, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.62, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q3: I feel supported in balancing my work responsibilities.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q3 Mean: I feel supported in balancing my work responsibilities.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q3 Mean: I feel supported in balancing my work responsibilities.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.51, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.55, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.52, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q4: I receive appropriate recognition when I do good work.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q4 Mean: I receive appropriate recognition when I do good work.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q4 Mean: I receive appropriate recognition when I do good work.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.54, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.59, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.60, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q5: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q5 Mean: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q5 Mean: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.67, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.75, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.75, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q6: I feel that resources in my immediate work environment are allocated to maximize effectiveness.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q6 Mean: I feel that resources in my immediate work environment are allocated to maximize effectiveness.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q6 Mean: I feel that resources in my immediate work environment are allocated to maximize effectiveness.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.53, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.57, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.48, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q7: I have the opportunity to provide input on decisions that affect my job.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q7 Mean: I have the opportunity to provide input on decisions that affect my job.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q7 Mean: I have the opportunity to provide input on decisions that affect my job.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.49, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.58, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.54, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q8: I have a clear understanding of my expectations as an employee.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q8 Mean: I have a clear understanding of my expectations as an employee.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q8 Mean: I have a clear understanding of my expectations as an employee.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.72, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.71, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.66, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q9: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q9 Mean: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q9 Mean: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.62, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.66, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.60, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q10: I receive feedback concerning areas for improving my performance.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q10 Mean: I receive feedback concerning areas for improving my performance.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q10 Mean: I receive feedback concerning areas for improving my performance.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.59, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.63, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.52, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q11: I feel that organization-level resources are allocated to maximize effectiveness across the organization.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q11 Mean: I feel that organization-level resources are allocated to maximize effectiveness across the organization.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q11 Mean: I feel that organization-level resources are allocated to maximize effectiveness across the organization.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.54, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.46, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.50, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q12: I believe organization-level information is communicated in a timely manner across the organization.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q12 Mean: I believe organization-level information is communicated in a timely manner across the organization.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q12 Mean: I believe organization-level information is communicated in a timely manner across the organization.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.65, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.43, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.56, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q13: I see progress being made to create a culture of success for employees across the organization and for those we serve.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q13 Mean: I see progress being made to create a culture of success for employees across the organization and for those we serve.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q13 Mean: I see progress being made to create a culture of success for employees across the organization and for those we serve.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.54, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.56, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.60, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q14: I would recommend that parents select my organization to serve their child.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q14 Mean: I would recommend that parents select my organization to serve their child.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q14 Mean: I would recommend that parents select my organization to serve their child.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.71, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.71, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.71, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q15: I feel that others in my organization connect with me in honest two-way communication.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q15 Mean: I feel that others in my organization connect with me in honest two-way communication.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q15 Mean: I feel that others in my organization connect with me in honest two-way communication.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.59, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.59, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.61, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q16: I work in an organization where employees regularly share and exchange ideas.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q16 Mean: I work in an organization where employees regularly share and exchange ideas.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q16 Mean: I work in an organization where employees regularly share and exchange ideas.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.69, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.67, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.67, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q17: I feel that organizational culture supports open and honest communication.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q17 Mean: I feel that organizational culture supports open and honest communication.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q17 Mean: I feel that organizational culture supports open and honest communication.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.60, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.55, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.59, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q18: I have a clear understanding of the mission and goals of my organization.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q18 Mean: I have a clear understanding of the mission and goals of my organization.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q18 Mean: I have a clear understanding of the mission and goals of my organization.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.73, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.72, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.67, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q19: I believe my work positively impacts those we serve.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q19 Mean: I believe my work positively impacts those we serve.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q19 Mean: I believe my work positively impacts those we serve.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.80, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.81, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.77, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q20: I feel a sense of pride when I tell people where I work.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q20 Mean: I feel a sense of pride when I tell people where I work.', 'mean', 'semi-annual', 4.50, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q20 Mean: I feel a sense of pride when I tell people where I work.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.68, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.68, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 4.68, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 4: Item Top Box % by Survey Administration (20 items x 3 admin)
-- ============================================================

-- Q1 Top Box: I feel supported with good processes and the appropriate resources to do my job.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q1 Top Box: I feel supported with good processes and the appropriate resources to do my job.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q1 Top Box: I feel supported with good processes and the appropriate resources to do my job.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 67.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 71.93, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 72.25, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q2 Top Box: I receive feedback on my strengths as an employee.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q2 Top Box: I receive feedback on my strengths as an employee.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q2 Top Box: I receive feedback on my strengths as an employee.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 65.74, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 71.49, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 72.69, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q3 Top Box: I feel supported in balancing my work responsibilities.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q3 Top Box: I feel supported in balancing my work responsibilities.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q3 Top Box: I feel supported in balancing my work responsibilities.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 62.96, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 64.47, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 66.52, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q4 Top Box: I receive appropriate recognition when I do good work.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q4 Top Box: I receive appropriate recognition when I do good work.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q4 Top Box: I receive appropriate recognition when I do good work.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 68.37, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 67.40, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 69.78, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q5 Top Box: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q5 Top Box: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q5 Top Box: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 75.00, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 80.70, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 83.70, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q6 Top Box: I feel that resources in my immediate work environment are allocated to maximize effectiveness.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q6 Top Box: I feel that resources in my immediate work environment are allocated to maximize effectiveness.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q6 Top Box: I feel that resources in my immediate work environment are allocated to maximize effectiveness.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 61.11, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 65.64, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 61.95, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q7 Top Box: I have the opportunity to provide input on decisions that affect my job.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q7 Top Box: I have the opportunity to provide input on decisions that affect my job.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q7 Top Box: I have the opportunity to provide input on decisions that affect my job.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 62.96, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 67.40, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 66.37, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q8 Top Box: I have a clear understanding of my expectations as an employee.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q8 Top Box: I have a clear understanding of my expectations as an employee.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q8 Top Box: I have a clear understanding of my expectations as an employee.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 73.95, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 74.45, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 74.89, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q9 Top Box: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q9 Top Box: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q9 Top Box: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 71.03, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 71.93, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 72.69, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q10 Top Box: I receive feedback concerning areas for improving my performance.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q10 Top Box: I receive feedback concerning areas for improving my performance.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q10 Top Box: I receive feedback concerning areas for improving my performance.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 67.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 71.49, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 66.52, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q11 Top Box: I feel that organization-level resources are allocated to maximize effectiveness across the organization.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q11 Top Box: I feel that organization-level resources are allocated to maximize effectiveness across the organization.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q11 Top Box: I feel that organization-level resources are allocated to maximize effectiveness across the organization.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 62.86, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 60.53, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 62.50, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q12 Top Box: I believe organization-level information is communicated in a timely manner across the organization.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q12 Top Box: I believe organization-level information is communicated in a timely manner across the organization.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q12 Top Box: I believe organization-level information is communicated in a timely manner across the organization.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 71.96, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 56.14, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 67.84, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q13 Top Box: I see progress being made to create a culture of success for employees across the organization and for those we serve.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q13 Top Box: I see progress being made to create a culture of success for employees across the organization and for those we serve.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q13 Top Box: I see progress being made to create a culture of success for employees across the organization and for those we serve.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 65.58, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 65.79, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 70.48, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q14 Top Box: I would recommend that parents select my organization to serve their child.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q14 Top Box: I would recommend that parents select my organization to serve their child.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q14 Top Box: I would recommend that parents select my organization to serve their child.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 76.74, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 75.88, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 79.65, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q15 Top Box: I feel that others in my organization connect with me in honest two-way communication.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q15 Top Box: I feel that others in my organization connect with me in honest two-way communication.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q15 Top Box: I feel that others in my organization connect with me in honest two-way communication.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 67.13, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 66.67, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 71.37, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q16 Top Box: I work in an organization where employees regularly share and exchange ideas.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q16 Top Box: I work in an organization where employees regularly share and exchange ideas.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q16 Top Box: I work in an organization where employees regularly share and exchange ideas.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 73.95, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 74.56, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 75.66, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q17 Top Box: I feel that organizational culture supports open and honest communication.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q17 Top Box: I feel that organizational culture supports open and honest communication.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q17 Top Box: I feel that organizational culture supports open and honest communication.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 67.91, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 66.96, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 70.48, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q18 Top Box: I have a clear understanding of the mission and goals of my organization.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q18 Top Box: I have a clear understanding of the mission and goals of my organization.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q18 Top Box: I have a clear understanding of the mission and goals of my organization.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 76.85, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 75.00, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 74.89, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q19 Top Box: I believe my work positively impacts those we serve.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q19 Top Box: I believe my work positively impacts those we serve.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q19 Top Box: I believe my work positively impacts those we serve.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 81.40, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 83.33, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 84.00, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

-- Q20 Top Box: I feel a sense of pride when I tell people where I work.
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('EE Q20 Top Box: I feel a sense of pride when I tell people where I work.', 'percentage', 'semi-annual', 75.00, true, 'EE Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'EE Q20 Top Box: I feel a sense of pride when I tell people where I work.';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 74.77, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 73.33, '2025-04-01', 'Spring 2025'),
  (v_metric_id, 77.33, '2025-11-01', 'Fall 2025')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'EE Full Survey Metrics: 52 metrics with data loaded successfully';

END $$;
