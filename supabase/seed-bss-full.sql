-- BSS (Business Support Services) Full Survey Metrics
-- Source: BSS Spring 2025 Results Report (Studer Education)
-- Data: 8 administrations (Fall 2021 - Spring 2025)
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

-- Find BSS process (create if missing)
SELECT id INTO v_process_id FROM processes WHERE name ILIKE '%Business Support%' LIMIT 1;
IF v_process_id IS NULL THEN
  SELECT id INTO v_cat_id FROM categories WHERE name ILIKE '%Leadership%' LIMIT 1;
  IF v_cat_id IS NULL THEN v_cat_id := 1; END IF;
  INSERT INTO processes (name, description, category_id, owner, process_type)
  VALUES ('Business Support Services Satisfaction', 'Internal customer satisfaction with Finance, HR, Office Professionals, and Technology departments', v_cat_id, 'Jon Malone', 'key')
  RETURNING id INTO v_process_id;
END IF;

-- ============================================================
-- TABLE 1a: Support Characteristic Means (8 administrations)
-- ============================================================

-- BSS Accessibility Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Accessibility Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accessibility Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.79, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.79, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.75, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.76, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.75, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.77, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.78, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Accuracy Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Accuracy Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accuracy Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.80, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.79, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.72, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.71, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.77, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.80, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.74, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.76, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Attitude Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Attitude Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Attitude Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.87, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.84, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.83, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.80, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.83, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.82, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.82, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Operations Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Operations Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Operations Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.77, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.77, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.75, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.66, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.77, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.77, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.69, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.68, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Timeliness Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Timeliness Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Timeliness Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.81, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.81, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.76, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.73, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.78, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.81, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.73, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.72, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Participation
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Participation', 'count', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Participation';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 121, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 165, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 174, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 150, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 147, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 150, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 165, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 159, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 1b: Support Characteristic Top Box % (8 administrations)
-- ============================================================

-- BSS Accessibility Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Accessibility Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accessibility Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 83.67, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 85.05, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 80.27, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 82.38, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 78.08, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 80.34, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 80.11, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 82.72, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Accuracy Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Accuracy Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accuracy Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.03, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 83.57, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 79.20, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 78.36, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 81.45, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 83.20, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 79.02, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 81.37, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Attitude Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Attitude Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Attitude Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 89.60, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 87.95, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 86.81, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 85.03, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 85.23, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 85.19, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 81.38, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 85.19, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Operations Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Operations Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Operations Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 82.51, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 81.31, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 80.36, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 72.49, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 80.00, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 81.67, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 76.35, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 78.29, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Timeliness Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Timeliness Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Timeliness Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 86.02, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 84.49, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 82.32, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 80.16, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 82.24, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 84.07, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 78.88, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 79.77, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 2a: Department Means (8 administrations)
-- ============================================================

-- BSS Finance Dept Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Finance Dept Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Finance Dept Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.76, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.83, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.70, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.71, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.77, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.82, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.81, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS HR Dept Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS HR Dept Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS HR Dept Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.80, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.74, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.71, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.66, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.72, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.71, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.72, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.78, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Office Professionals Dept Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('BSS Office Professionals Dept Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Office Professionals Dept Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.86, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.84, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.81, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.79, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.82, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.84, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.80, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.83, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Finance Dept Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Finance Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Finance Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 83.26, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 86.34, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 78.85, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 78.84, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 81.35, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 84.07, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 80.24, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 85.18, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS HR Dept Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS HR Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS HR Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 85.98, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 82.27, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 80.00, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 76.10, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 77.83, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 76.70, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 78.00, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 81.88, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- BSS Office Professionals Dept Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('BSS Office Professionals Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Office Professionals Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 87.97, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 86.15, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 84.67, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 84.11, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 84.88, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 86.97, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 83.11, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 86.31, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ELT OVERALL (8 administrations)
-- ============================================================

-- ELT BSS Participation
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Participation', 'count', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Participation';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 16, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 17, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 20, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 19, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 21, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 20, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 17, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 19, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Accessibility Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Accessibility Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accessibility Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.76, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.91, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.74, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.85, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.85, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.87, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.93, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.96, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Accuracy Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Accuracy Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accuracy Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.78, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.88, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.66, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.86, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.84, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.88, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.91, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.96, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Attitude Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Attitude Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Attitude Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.84, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.85, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.80, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.85, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.84, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.91, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.97, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.97, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Operations Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Operations Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Operations Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.78, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.82, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.66, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.74, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.84, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.82, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.93, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.90, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Timeliness Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Timeliness Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Timeliness Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.81, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.94, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.74, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.76, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.84, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.89, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.93, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.97, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Accessibility Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Accessibility Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accessibility Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.13, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 90.91, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 80.00, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 90.67, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 87.65, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 89.87, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 92.54, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 97.30, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Accuracy Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Accuracy Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accuracy Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.13, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 88.06, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 72.50, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 90.79, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 88.89, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 90.79, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 91.04, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 95.95, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Attitude Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Attitude Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Attitude Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 85.71, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 89.55, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 83.75, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 92.00, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 88.89, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 93.67, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 97.01, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 98.65, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Operations Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Operations Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Operations Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.13, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 86.57, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 70.89, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 79.73, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 86.75, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 84.81, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 92.54, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 90.41, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Timeliness Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Timeliness Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Timeliness Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 87.30, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 94.03, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 81.25, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 85.14, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 88.31, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 91.78, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 92.54, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 97.30, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ELT Department Means (8 administrations)
-- ============================================================

-- ELT BSS Finance Dept Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Finance Dept Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Finance Dept Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.79, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.94, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.87, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.99, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.89, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.94, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.95, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 5.00, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS HR Dept Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS HR Dept Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS HR Dept Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.80, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.91, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.40, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.49, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.76, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.68, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.92, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.94, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Office Professionals Dept Mean
INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Office Professionals Dept Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Office Professionals Dept Mean';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 4.85, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 4.76, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 4.75, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 4.81, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 4.86, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 4.89, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 4.92, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 4.97, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Finance Dept Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Finance Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Finance Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 84.00, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 95.00, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 86.87, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 98.89, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 94.95, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 93.81, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 95.00, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 100.00, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS HR Dept Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS HR Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS HR Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 82.50, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 91.76, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 62.00, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 69.47, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 79.17, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 73.91, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 91.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 94.44, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Office Professionals Dept Top Box
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Office Professionals Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Office Professionals Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 86.25, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 79.76, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 76.00, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 86.32, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 90.38, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 93.88, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 91.76, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 97.87, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

-- ELT BSS Technology Dept Top Box (note: Tech Mean already exists from seed.ts)
INSERT INTO metrics (name, unit, cadence, is_higher_better, data_source, collection_method)
VALUES ('ELT BSS Technology Dept Top Box %', 'percentage', 'semi-annual', true, 'BSS Survey - ELT', 'Semi-annual survey')
ON CONFLICT (name) DO NOTHING;
SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Technology Dept Top Box %';
INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
  (v_metric_id, 87.50, '2021-11-01', 'Fall 2021'),
  (v_metric_id, 92.94, '2022-04-01', 'Spring 2022'),
  (v_metric_id, 86.00, '2022-11-01', 'Fall 2022'),
  (v_metric_id, 96.81, '2023-04-01', 'Spring 2023'),
  (v_metric_id, 87.50, '2023-11-01', 'Fall 2023'),
  (v_metric_id, 97.98, '2024-04-01', 'Spring 2024'),
  (v_metric_id, 94.12, '2024-11-01', 'Fall 2024'),
  (v_metric_id, 91.58, '2025-04-01', 'Spring 2025')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'BSS full survey metrics loaded successfully';
END $$;
