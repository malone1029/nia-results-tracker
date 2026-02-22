-- Fix MDS metric names: rename to verbatim/full names, fix data_source,
-- create missing Overall and Characteristic Top Box metrics.
-- Source: Member District Services Survey Fall 2025 Results Report (Studer Education)

-- ============================================================
-- STEP 1: Rename characteristic mean metrics
-- ============================================================

UPDATE metrics SET name = 'MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'MDS: Accessibility Mean';
UPDATE metrics SET name = 'MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'MDS: Accuracy Mean';
UPDATE metrics SET name = 'MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'MDS: Attitude Mean';
UPDATE metrics SET name = 'MDS Operations Mean: Do day to day operations run efficiently and effectively?'
  WHERE name = 'MDS: Operations Mean';
UPDATE metrics SET name = 'MDS Timeliness Mean: Was the response or solution delivered when promised?'
  WHERE name = 'MDS: Timeliness Mean';

UPDATE metrics SET name = 'MDS Participation Count'
  WHERE name = 'MDS: Participation Count';

-- ============================================================
-- STEP 2: Rename department metrics to full names
-- ============================================================

UPDATE metrics SET name = 'MDS Audiology: Overall Mean'         WHERE name = 'MDS: Audiology Mean';
UPDATE metrics SET name = 'MDS Audiology: Overall Top Box'      WHERE name = 'MDS: Audiology Top Box %';

UPDATE metrics SET name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Mean'    WHERE name = 'MDS: Deaf/HH Itinerant Mean';
UPDATE metrics SET name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Top Box' WHERE name = 'MDS: Deaf/HH Itinerant Top Box %';

UPDATE metrics SET name = 'MDS Occupational and Physical Therapy: Overall Mean'    WHERE name = 'MDS: OT/PT Mean';
UPDATE metrics SET name = 'MDS Occupational and Physical Therapy: Overall Top Box' WHERE name = 'MDS: OT/PT Top Box %';

UPDATE metrics SET name = 'MDS Speech Therapy: Overall Mean'    WHERE name = 'MDS: Speech Therapy Mean';
UPDATE metrics SET name = 'MDS Speech Therapy: Overall Top Box' WHERE name = 'MDS: Speech Therapy Top Box %';

UPDATE metrics SET name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean'    WHERE name = 'MDS: Vision/O&M/CATIS Mean';
UPDATE metrics SET name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box' WHERE name = 'MDS: Vision/O&M/CATIS Top Box %';

UPDATE metrics SET name = 'MDS Billing and Invoicing: Overall Mean'    WHERE name = 'MDS: Billing & Invoicing Mean';
UPDATE metrics SET name = 'MDS Billing and Invoicing: Overall Top Box' WHERE name = 'MDS: Billing & Invoicing Top Box %';

UPDATE metrics SET name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Mean'    WHERE name = 'MDS: Needs Assessment Mean';
UPDATE metrics SET name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box' WHERE name = 'MDS: Needs Assessment Top Box %';

-- ============================================================
-- STEP 3: Fix data_source label
-- ============================================================

UPDATE metrics SET data_source = 'MDS Survey'
  WHERE data_source = 'Studer MDS Survey';

-- ============================================================
-- STEP 4: Create missing Overall Mean + Overall Top Box metrics
--         with all 3 survey administrations
-- ============================================================

DO $$
DECLARE
  v_process_id INTEGER;
  v_metric_id  INTEGER;
BEGIN
  SELECT id INTO v_process_id FROM processes WHERE name ILIKE '%Member District%' LIMIT 1;

  -- Overall Mean
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

  -- Overall Top Box
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('MDS Overall Top Box', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Overall Top Box';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 84.27, '2024-11-01', 'Nov 2024'),
    (v_metric_id, 91.77, '2025-03-01', 'Mar 2025'),
    (v_metric_id, 85.24, '2025-10-01', 'Oct 2025')
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- STEP 5: Create missing Characteristic Top Box metrics
  --         with all 3 survey administrations
  -- ============================================================

  -- Accessibility Top Box
  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
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
  VALUES ('MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
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
  VALUES ('MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
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
  VALUES ('MDS Operations Top Box: Do day to day operations run efficiently and effectively?', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
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
  VALUES ('MDS Timeliness Top Box: Was the response or solution delivered when promised?', 'percentage', 'semi-annual', 75.00, true, 'MDS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'MDS Timeliness Top Box: Was the response or solution delivered when promised?';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 84.47, '2024-11-01', 'Nov 2024'),
    (v_metric_id, 92.63, '2025-03-01', 'Mar 2025'),
    (v_metric_id, 87.01, '2025-10-01', 'Oct 2025')
  ON CONFLICT DO NOTHING;

END $$;
