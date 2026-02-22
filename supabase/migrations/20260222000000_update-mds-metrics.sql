-- Update MDS metrics: rename to verbatim/full names, update cadence,
-- add Nov 2024 and Oct 2025 data, create missing department metrics.
-- Source: Member District Services Survey Fall 2025 Results Report (Studer Education)
-- Run once in the Supabase SQL Editor.

-- ============================================================
-- STEP 1: Rename characteristic metrics to include verbatim
--         survey question text; fix Top Box % → Top Box naming
-- ============================================================

UPDATE metrics SET name = 'MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'MDS Accessibility Mean';
UPDATE metrics SET name = 'MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'MDS Accuracy Mean';
UPDATE metrics SET name = 'MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'MDS Attitude Mean';
UPDATE metrics SET name = 'MDS Operations Mean: Do day to day operations run efficiently and effectively?'
  WHERE name = 'MDS Operations Mean';
UPDATE metrics SET name = 'MDS Timeliness Mean: Was the response or solution delivered when promised?'
  WHERE name = 'MDS Timeliness Mean';

UPDATE metrics SET name = 'MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'MDS Accessibility Top Box %';
UPDATE metrics SET name = 'MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'MDS Accuracy Top Box %';
UPDATE metrics SET name = 'MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'MDS Attitude Top Box %';
UPDATE metrics SET name = 'MDS Operations Top Box: Do day to day operations run efficiently and effectively?'
  WHERE name = 'MDS Operations Top Box %';
UPDATE metrics SET name = 'MDS Timeliness Top Box: Was the response or solution delivered when promised?'
  WHERE name = 'MDS Timeliness Top Box %';

-- Overall Top Box % → remove %
UPDATE metrics SET name = 'MDS Overall Top Box'
  WHERE name = 'MDS Overall Top Box %';

-- ============================================================
-- STEP 2: Rename department metrics to full department names
-- ============================================================

UPDATE metrics SET name = 'MDS Audiology: Overall Mean'         WHERE name = 'MDS Audiology Mean';
UPDATE metrics SET name = 'MDS Audiology: Overall Top Box'      WHERE name = 'MDS Audiology Top Box %';

UPDATE metrics SET name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Mean'    WHERE name = 'MDS DHH Itinerant Mean';
UPDATE metrics SET name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Top Box' WHERE name = 'MDS DHH Itinerant Top Box %';

UPDATE metrics SET name = 'MDS Occupational and Physical Therapy: Overall Mean'    WHERE name = 'MDS OT/PT Mean';
UPDATE metrics SET name = 'MDS Occupational and Physical Therapy: Overall Top Box' WHERE name = 'MDS OT/PT Top Box %';

UPDATE metrics SET name = 'MDS Speech Therapy: Overall Mean'    WHERE name = 'MDS Speech Therapy Mean';
UPDATE metrics SET name = 'MDS Speech Therapy: Overall Top Box' WHERE name = 'MDS Speech Therapy Top Box %';

UPDATE metrics SET name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean'    WHERE name = 'MDS Vision/O&M/CATIS Mean';
UPDATE metrics SET name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box' WHERE name = 'MDS Vision/O&M/CATIS Top Box %';

UPDATE metrics SET name = 'MDS Billing and Invoicing: Overall Mean'    WHERE name = 'MDS Billing/Invoicing Mean';
UPDATE metrics SET name = 'MDS Billing and Invoicing: Overall Top Box' WHERE name = 'MDS Billing/Invoicing Top Box %';

UPDATE metrics SET name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Mean'    WHERE name = 'MDS Needs Assessment Mean';
UPDATE metrics SET name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box' WHERE name = 'MDS Needs Assessment Top Box %';

-- ============================================================
-- STEP 3: Fix cadence from 'annual' to 'semi-annual' for all MDS metrics
-- ============================================================

UPDATE metrics SET cadence = 'semi-annual'
  WHERE data_source = 'MDS Survey' AND cadence = 'annual';

-- Also update the collection_method label
UPDATE metrics SET collection_method = 'Semi-annual survey'
  WHERE data_source = 'MDS Survey' AND collection_method = 'Annual spring survey';

-- ============================================================
-- STEP 4: Add missing Nov 2024 and Oct 2025 entries to
--         org-level metrics (currently only have Spring 2025)
-- ============================================================

-- Overall Mean
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.82, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Overall Mean' ON CONFLICT DO NOTHING;

-- Overall Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 84.27, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 85.24, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Overall Top Box' ON CONFLICT DO NOTHING;

-- Participation
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 25, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Participation' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 22, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Participation' ON CONFLICT DO NOTHING;

-- Accessibility Mean
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.84, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.81, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?' ON CONFLICT DO NOTHING;

-- Accuracy Mean
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.78, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?' ON CONFLICT DO NOTHING;

-- Attitude Mean
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.86, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.89, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?' ON CONFLICT DO NOTHING;

-- Operations Mean
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.78, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Operations Mean: Do day to day operations run efficiently and effectively?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.80, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Operations Mean: Do day to day operations run efficiently and effectively?' ON CONFLICT DO NOTHING;

-- Timeliness Mean
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.85, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Timeliness Mean: Was the response or solution delivered when promised?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Timeliness Mean: Was the response or solution delivered when promised?' ON CONFLICT DO NOTHING;

-- Accessibility Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 84.47, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.54, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?' ON CONFLICT DO NOTHING;

-- Accuracy Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 84.47, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 82.28, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?' ON CONFLICT DO NOTHING;

-- Attitude Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 87.38, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 89.87, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?' ON CONFLICT DO NOTHING;

-- Operations Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 80.58, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Operations Top Box: Do day to day operations run efficiently and effectively?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.54, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Operations Top Box: Do day to day operations run efficiently and effectively?' ON CONFLICT DO NOTHING;

-- Timeliness Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 84.47, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Timeliness Top Box: Was the response or solution delivered when promised?' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 87.01, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Timeliness Top Box: Was the response or solution delivered when promised?' ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Add missing Nov 2024 and Oct 2025 entries to
--         department metrics (currently only have Spring 2025)
-- ============================================================

-- Audiology
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.85, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Audiology: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.70, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Audiology: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 85.00, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Audiology: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 70.00, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Audiology: Overall Top Box' ON CONFLICT DO NOTHING;

-- Billing and Invoicing
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.70, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Billing and Invoicing: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.95, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Billing and Invoicing: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 70.00, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Billing and Invoicing: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 95.00, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Billing and Invoicing: Overall Top Box' ON CONFLICT DO NOTHING;

-- Deaf/Hard of Hearing Itinerant
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.80, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.70, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.33, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 81.48, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Top Box' ON CONFLICT DO NOTHING;

-- Needs Assessment
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.96, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 82.50, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 96.00, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box' ON CONFLICT DO NOTHING;

-- Occupational and Physical Therapy
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.92, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Occupational and Physical Therapy: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Occupational and Physical Therapy: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 92.31, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Occupational and Physical Therapy: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.33, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Occupational and Physical Therapy: Overall Top Box' ON CONFLICT DO NOTHING;

-- Speech Therapy
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 5.00, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Speech Therapy: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.71, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Speech Therapy: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 100.00, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Speech Therapy: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 71.43, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Speech Therapy: Overall Top Box' ON CONFLICT DO NOTHING;

-- Vision, Orientation and Mobility (O&M) and CATIS
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.79, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.99, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 84.21, '2024-11-01', 'Nov 2024' FROM metrics WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box' ON CONFLICT DO NOTHING;
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 98.67, '2025-10-01', 'Oct 2025' FROM metrics WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box' ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 6: Create new department metrics that didn't exist before
--         (DHH Self-Contained and Tech Assistance — Nov 2024 only)
-- ============================================================

DO $$
DECLARE
  v_process_id INTEGER;
  v_metric_id  INTEGER;
BEGIN
  SELECT id INTO v_process_id FROM processes WHERE name ILIKE '%Member District%' LIMIT 1;

  -- DHH Self-Contained/Cluster (Nov 2024 only)
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Mean';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 4.73, '2024-11-01', 'Nov 2024') ON CONFLICT DO NOTHING;

  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Top Box', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Deaf and Hard of Hearing Self-Contained/Cluster Program: Overall Top Box';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 73.33, '2024-11-01', 'Nov 2024') ON CONFLICT DO NOTHING;

  -- Technical Assistance: Autism/Assistive Technology/Inclusion (Nov 2024 only)
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Mean', 'mean', 'semi-annual', 4.50, true, 'MDS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Mean';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 4.86, '2024-11-01', 'Nov 2024') ON CONFLICT DO NOTHING;

  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Top Box', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Technical Assistance (Autism/Assistive Technology/Inclusion): Overall Top Box';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 85.71, '2024-11-01', 'Nov 2024') ON CONFLICT DO NOTHING;

END $$;
