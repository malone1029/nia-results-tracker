-- MDS (Member District Services) Full Survey Metrics
-- Source: Member District Experience Survey Spring 2025 Results Report (Studer Education)
-- Data: Spring 2025 only (single administration visible in report)
-- Departments with n<5 excluded: DHH Self-Contained, Sign Language, Tech Assistance, BCBA, Social Work
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

-- Find MDS process (create if missing)
SELECT id INTO v_process_id FROM processes WHERE name ILIKE '%Member District%' LIMIT 1;
IF v_process_id IS NULL THEN
  SELECT id INTO v_cat_id FROM categories WHERE name ILIKE '%Customer%' LIMIT 1;
  IF v_cat_id IS NULL THEN
    SELECT id INTO v_cat_id FROM categories WHERE name ILIKE '%Results%' LIMIT 1;
  END IF;
  IF v_cat_id IS NULL THEN v_cat_id := 1; END IF;
  INSERT INTO processes (name, description, category_id, owner, process_type)
  VALUES ('Member District Services Satisfaction', 'External customer satisfaction with NIA service departments', v_cat_id, 'Jon Malone', 'key')
  RETURNING id INTO v_process_id;
END IF;

-- ============================================================
-- OVERALL STATS
-- ============================================================

-- MDS Overall Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Overall Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.90, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Overall Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Overall Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Overall Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 91.77, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Participation
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Participation', 'count', 'annual', NULL, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Participation';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 22, '2025-04-01', 'Spring 2025 — 22 respondents')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUPPORT CHARACTERISTIC MEANS (5 characteristics)
-- ============================================================

-- MDS Accessibility Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accessibility Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accessibility Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.92, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Accuracy Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accuracy Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accuracy Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.87, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Attitude Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Attitude Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Attitude Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.95, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Operations Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Operations Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Operations Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.86, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Timeliness Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Timeliness Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Timeliness Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.92, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUPPORT CHARACTERISTIC TOP BOX % (5 characteristics)
-- ============================================================

-- MDS Accessibility Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accessibility Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accessibility Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 91.58, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Accuracy Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accuracy Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accuracy Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 89.36, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Attitude Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Attitude Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Attitude Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 94.74, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Operations Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Operations Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Operations Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 90.53, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- MDS Timeliness Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Timeliness Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Timeliness Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 92.63, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEPARTMENT MEANS (7 departments with n>=5)
-- ============================================================

-- MDS Audiology Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Audiology Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Audiology Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.85, '2025-04-01', 'Spring 2025 — n=12')
ON CONFLICT DO NOTHING;

-- MDS DHH Itinerant Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS DHH Itinerant Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS DHH Itinerant Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.89, '2025-04-01', 'Spring 2025 — n=9')
ON CONFLICT DO NOTHING;

-- MDS OT/PT Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS OT/PT Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS OT/PT Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.97, '2025-04-01', 'Spring 2025 — n=12')
ON CONFLICT DO NOTHING;

-- MDS Speech Therapy Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Speech Therapy Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Speech Therapy Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 5.00, '2025-04-01', 'Spring 2025 — n=8, perfect score')
ON CONFLICT DO NOTHING;

-- MDS Vision/O&M/CATIS Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Vision/O&M/CATIS Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Vision/O&M/CATIS Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.97, '2025-04-01', 'Spring 2025 — n=14')
ON CONFLICT DO NOTHING;

-- MDS Billing/Invoicing Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Billing/Invoicing Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Billing/Invoicing Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.89, '2025-04-01', 'Spring 2025 — n=13')
ON CONFLICT DO NOTHING;

-- MDS Needs Assessment Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Needs Assessment Mean', 'mean', 'annual', 4.50, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Needs Assessment Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.93, '2025-04-01', 'Spring 2025 — n=12')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEPARTMENT TOP BOX % (7 departments with n>=5)
-- ============================================================

-- MDS Audiology Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Audiology Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Audiology Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 85.00, '2025-04-01', 'Spring 2025 — n=12')
ON CONFLICT DO NOTHING;

-- MDS DHH Itinerant Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS DHH Itinerant Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS DHH Itinerant Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 91.11, '2025-04-01', 'Spring 2025 — n=9')
ON CONFLICT DO NOTHING;

-- MDS OT/PT Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS OT/PT Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS OT/PT Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 96.67, '2025-04-01', 'Spring 2025 — n=12')
ON CONFLICT DO NOTHING;

-- MDS Speech Therapy Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Speech Therapy Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Speech Therapy Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 100.00, '2025-04-01', 'Spring 2025 — n=8, perfect score')
ON CONFLICT DO NOTHING;

-- MDS Vision/O&M/CATIS Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Vision/O&M/CATIS Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Vision/O&M/CATIS Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 97.10, '2025-04-01', 'Spring 2025 — n=14')
ON CONFLICT DO NOTHING;

-- MDS Billing/Invoicing Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Billing/Invoicing Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Billing/Invoicing Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 89.23, '2025-04-01', 'Spring 2025 — n=13')
ON CONFLICT DO NOTHING;

-- MDS Needs Assessment Top Box %
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Needs Assessment Top Box %', 'percentage', 'annual', 85.00, true, 'MDS Survey', 'Annual spring survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Needs Assessment Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 93.33, '2025-04-01', 'Spring 2025 — n=12')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'MDS Full Survey Metrics: 27 metrics with data loaded successfully';

END $$;
