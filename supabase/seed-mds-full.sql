-- MDS (Member District Services) Full Survey Metrics
-- Source: Member District Services Survey Fall 2025 Results Report (Studer Education)
-- Data: All 3 administrations — Nov 2024, Mar 2025 (Spring 2025), Oct 2025 (Fall 2025)
-- Departments with n<5 in all periods excluded: BCBA, Psychology, Sign Language, Social Work
-- DHH Self-Contained and Technical Assistance: Nov 2024 only (n<5 in later periods)
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
VALUES ('MDS Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.83, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.90, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.82, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- MDS Overall Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.27, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 91.77, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 85.24, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- MDS Participation Count
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Participation Count', 'count', 'semi-annual', NULL, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Participation Count';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 25, '2024-11-01', 'Nov 2024 — 25 respondents'),
  (v_metric_id, 22, '2025-03-01', 'Mar 2025 — 22 respondents'),
  (v_metric_id, 22, '2025-10-01', 'Oct 2025 — 22 respondents')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUPPORT CHARACTERISTIC MEANS (5 characteristics)
-- Survey question text included verbatim
-- ============================================================

-- Accessibility Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.84, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.92, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.81, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Accuracy Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.83, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.87, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.78, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Attitude Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.86, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.95, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.89, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Operations Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Operations Mean: Do day to day operations run efficiently and effectively?', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Operations Mean: Do day to day operations run efficiently and effectively?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.78, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.86, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.80, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Timeliness Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Timeliness Mean: Was the response or solution delivered when promised?', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Timeliness Mean: Was the response or solution delivered when promised?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.85, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.92, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.83, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUPPORT CHARACTERISTIC TOP BOX (5 characteristics)
-- ============================================================

-- Accessibility Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.47, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 91.58, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 83.54, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Accuracy Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.47, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 89.36, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 82.28, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Attitude Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 87.38, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 94.74, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 89.87, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Operations Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Operations Top Box: Do day to day operations run efficiently and effectively?', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Operations Top Box: Do day to day operations run efficiently and effectively?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 80.58, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 90.53, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 83.54, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Timeliness Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Timeliness Top Box: Was the response or solution delivered when promised?', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Timeliness Top Box: Was the response or solution delivered when promised?';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.47, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 92.63, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 87.01, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEPARTMENT MEANS (7 departments with n>=5 in at least one period)
-- ============================================================

-- Audiology
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Audiology: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Audiology: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.85, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.85, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.70, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Deaf/Hard of Hearing Itinerant
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Deaf/Hard of Hearing Itinerant: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.80, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.89, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.70, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Occupational and Physical Therapy
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Occupational and Physical Therapy: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Occupational and Physical Therapy: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.92, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.97, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.83, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Speech Therapy
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Speech Therapy: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Speech Therapy: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 5.00, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 5.00, '2025-03-01', 'Mar 2025 — perfect score'),
  (v_metric_id, 4.71, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Vision, Orientation and Mobility (O&M) and CATIS
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.79, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.97, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.99, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Billing and Invoicing
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Billing and Invoicing: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Billing and Invoicing: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.70, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.89, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.95, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Needs Assessment, Recommendations and Change Forms
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Needs Assessment, Recommendations and Change Forms: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.83, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 4.93, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 4.96, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEPARTMENT TOP BOX (7 departments with n>=5 in at least one period)
-- ============================================================

-- Audiology Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Audiology: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Audiology: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 85.00, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 85.00, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 70.00, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Deaf/Hard of Hearing Itinerant Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Deaf/Hard of Hearing Itinerant: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 83.33, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 91.11, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 81.48, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Occupational and Physical Therapy Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Occupational and Physical Therapy: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Occupational and Physical Therapy: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 92.31, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 96.67, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 83.33, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Speech Therapy Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Speech Therapy: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Speech Therapy: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 100.00, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 100.00, '2025-03-01', 'Mar 2025 — perfect score'),
  (v_metric_id, 71.43, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Vision, Orientation and Mobility (O&M) and CATIS Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.21, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 97.10, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 98.67, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Billing and Invoicing Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Billing and Invoicing: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Billing and Invoicing: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 70.00, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 89.23, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 95.00, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- Needs Assessment, Recommendations and Change Forms Top Box
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box', 'percentage', 'semi-annual', 85.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 82.50, '2024-11-01', 'Nov 2024'),
  (v_metric_id, 93.33, '2025-03-01', 'Mar 2025'),
  (v_metric_id, 96.00, '2025-10-01', 'Oct 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEPARTMENT MEANS + TOP BOX — Nov 2024 only
-- (n<5 in all subsequent administrations)
-- ============================================================

-- Deaf and Hard of Hearing Self-Contained/Cluster Program
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.73, '2024-11-01', 'Nov 2024')
ON CONFLICT DO NOTHING;

INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Top Box', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 73.33, '2024-11-01', 'Nov 2024')
ON CONFLICT DO NOTHING;

-- Technical Assistance (Autism/Assistive Technology/Inclusion)
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.86, '2024-11-01', 'Nov 2024')
ON CONFLICT DO NOTHING;

INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Top Box', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Top Box';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 85.71, '2024-11-01', 'Nov 2024')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'MDS Full Survey Metrics: 31 metrics loaded — 3 overall + 10 characteristics + 16 department + 2 limited-period';

END $$;
