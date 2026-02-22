-- Update BSS metrics: rename to verbatim/full names, add Fall 2025 data,
-- fix orphaned Overall metrics, create missing BSS Overall Mean.
-- Source: Business Support Services Survey Fall 2025 Results Report (Studer Education)
-- Survey asks NIA employees to rate internal support departments.
-- Same 5 support characteristics as MDS survey.

-- ============================================================
-- STEP 1: Rename canonical (all-employee) characteristic means
-- ============================================================

UPDATE metrics SET name = 'BSS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'BSS Accessibility Mean';
UPDATE metrics SET name = 'BSS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'BSS Accuracy Mean';
UPDATE metrics SET name = 'BSS Attitude Mean: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'BSS Attitude Mean';
UPDATE metrics SET name = 'BSS Operations Mean: Do day to day operations run efficiently and effectively?'
  WHERE name = 'BSS Operations Mean';
UPDATE metrics SET name = 'BSS Timeliness Mean: Was the response or solution delivered when promised?'
  WHERE name = 'BSS Timeliness Mean';

-- ============================================================
-- STEP 2: Rename characteristic Top Box (remove %, add verbatim)
-- ============================================================

UPDATE metrics SET name = 'BSS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'BSS Accessibility Top Box %';
UPDATE metrics SET name = 'BSS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'BSS Accuracy Top Box %';
UPDATE metrics SET name = 'BSS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'BSS Attitude Top Box %';
UPDATE metrics SET name = 'BSS Operations Top Box: Do day to day operations run efficiently and effectively?'
  WHERE name = 'BSS Operations Top Box %';
UPDATE metrics SET name = 'BSS Timeliness Top Box: Was the response or solution delivered when promised?'
  WHERE name = 'BSS Timeliness Top Box %';

-- ============================================================
-- STEP 3: Rename department metrics to full consistent names
-- ============================================================

UPDATE metrics SET name = 'BSS Finance: Overall Mean'                WHERE name = 'BSS Finance Dept Mean';
UPDATE metrics SET name = 'BSS Finance: Overall Top Box'             WHERE name = 'BSS Finance Dept Top Box %';
UPDATE metrics SET name = 'BSS Human Resources: Overall Mean'        WHERE name = 'BSS HR Dept Mean';
UPDATE metrics SET name = 'BSS Human Resources: Overall Top Box'     WHERE name = 'BSS HR Dept Top Box %';
UPDATE metrics SET name = 'BSS Office Professionals: Overall Mean'   WHERE name = 'BSS Office Professionals Dept Mean';
UPDATE metrics SET name = 'BSS Office Professionals: Overall Top Box' WHERE name = 'BSS Office Professionals Dept Top Box %';
UPDATE metrics SET name = 'BSS Technology: Overall Mean'             WHERE name = 'Technology Dept BSS Mean';
UPDATE metrics SET name = 'BSS Technology: Overall Top Box'          WHERE name = 'Technology Dept BSS Top Box %';
UPDATE metrics SET name = 'BSS Participation Count'                  WHERE name = 'BSS Participation';

-- ============================================================
-- STEP 4: Fix orphaned Overall metrics (Studer group, 0 process links)
--         Adopt them into the canonical group by fixing source + name
-- ============================================================

-- BSS Overall Top Box: already has Fall 2023–Fall 2025 data
UPDATE metrics
  SET name = 'BSS Overall Top Box', data_source = 'BSS Survey'
  WHERE name = 'BSS Overall Top Box %' AND data_source = 'Studer BSS Survey';

-- ELT Overall Mean: already has Fall 2023–Fall 2025 data
UPDATE metrics
  SET data_source = 'BSS Survey - ELT'
  WHERE name = 'ELT BSS Overall Mean' AND data_source = 'Studer BSS Survey';

-- ELT Overall Top Box: rename and adopt
UPDATE metrics
  SET name = 'ELT BSS Overall Top Box', data_source = 'BSS Survey - ELT'
  WHERE name = 'BSS: ELT Overall Top Box %' AND data_source = 'Studer BSS Survey';

-- ============================================================
-- STEP 5: Rename ELT characteristic metrics
-- ============================================================

UPDATE metrics SET name = 'ELT BSS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'ELT BSS Accessibility Mean';
UPDATE metrics SET name = 'ELT BSS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'ELT BSS Accuracy Mean';
UPDATE metrics SET name = 'ELT BSS Attitude Mean: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'ELT BSS Attitude Mean';
UPDATE metrics SET name = 'ELT BSS Operations Mean: Do day to day operations run efficiently and effectively?'
  WHERE name = 'ELT BSS Operations Mean';
UPDATE metrics SET name = 'ELT BSS Timeliness Mean: Was the response or solution delivered when promised?'
  WHERE name = 'ELT BSS Timeliness Mean';

UPDATE metrics SET name = 'ELT BSS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?'
  WHERE name = 'ELT BSS Accessibility Top Box %';
UPDATE metrics SET name = 'ELT BSS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?'
  WHERE name = 'ELT BSS Accuracy Top Box %';
UPDATE metrics SET name = 'ELT BSS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?'
  WHERE name = 'ELT BSS Attitude Top Box %';
UPDATE metrics SET name = 'ELT BSS Operations Top Box: Do day to day operations run efficiently and effectively?'
  WHERE name = 'ELT BSS Operations Top Box %';
UPDATE metrics SET name = 'ELT BSS Timeliness Top Box: Was the response or solution delivered when promised?'
  WHERE name = 'ELT BSS Timeliness Top Box %';

-- ============================================================
-- STEP 6: Rename ELT department metrics
-- ============================================================

UPDATE metrics SET name = 'ELT BSS Finance: Overall Mean'                WHERE name = 'ELT BSS Finance Dept Mean';
UPDATE metrics SET name = 'ELT BSS Finance: Overall Top Box'             WHERE name = 'ELT BSS Finance Dept Top Box %';
UPDATE metrics SET name = 'ELT BSS Human Resources: Overall Mean'        WHERE name = 'ELT BSS HR Dept Mean';
UPDATE metrics SET name = 'ELT BSS Human Resources: Overall Top Box'     WHERE name = 'ELT BSS HR Dept Top Box %';
UPDATE metrics SET name = 'ELT BSS Office Professionals: Overall Mean'   WHERE name = 'ELT BSS Office Professionals Dept Mean';
UPDATE metrics SET name = 'ELT BSS Office Professionals: Overall Top Box' WHERE name = 'ELT BSS Office Professionals Dept Top Box %';
UPDATE metrics SET name = 'ELT BSS Technology: Overall Top Box'          WHERE name = 'ELT BSS Technology Dept Top Box %';
UPDATE metrics SET name = 'ELT BSS Participation Count'                  WHERE name = 'ELT BSS Participation';

-- ============================================================
-- STEP 7: Add Fall 2025 entries and link orphaned Overall metrics
-- ============================================================

DO $$
DECLARE
  v_bss_process_id  INTEGER;
  v_elt_process_id  INTEGER;
  v_metric_id       INTEGER;
BEGIN
  -- Get process IDs from existing metric links
  SELECT mp.process_id INTO v_bss_process_id
    FROM metric_processes mp
    JOIN metrics m ON m.id = mp.metric_id
    WHERE m.name = 'BSS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
    LIMIT 1;

  SELECT mp.process_id INTO v_elt_process_id
    FROM metric_processes mp
    JOIN metrics m ON m.id = mp.metric_id
    WHERE m.name = 'ELT BSS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
    LIMIT 1;

  -- If ELT is linked to same process, that's fine — use same
  IF v_elt_process_id IS NULL THEN
    v_elt_process_id := v_bss_process_id;
  END IF;

  -- -------------------------------------------------------
  -- Link the adopted Overall metrics to their processes
  -- -------------------------------------------------------

  -- BSS Overall Top Box (now canonical)
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Overall Top Box';
  UPDATE metrics SET data_source = 'BSS Survey' WHERE id = v_metric_id;
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_bss_process_id) ON CONFLICT DO NOTHING;

  -- ELT BSS Overall Mean
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Overall Mean';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_elt_process_id) ON CONFLICT DO NOTHING;

  -- ELT BSS Overall Top Box
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Overall Top Box';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_elt_process_id) ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Create BSS Overall Mean (all employees, canonical)
  -- Data available from Fall 2023 onwards in Studer PDFs
  -- -------------------------------------------------------

  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('BSS Overall Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Overall Mean';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_bss_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 4.78, '2023-11-01', 'Fall 2023'),
    (v_metric_id, 4.79, '2024-04-01', 'Spring 2024'),
    (v_metric_id, 4.74, '2024-11-01', 'Fall 2024'),
    (v_metric_id, 4.75, '2025-04-01', 'Spring 2025'),
    (v_metric_id, 4.78, '2025-11-01', 'Fall 2025')
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Add Fall 2025 (2025-11-01) to canonical characteristic metrics
  -- -------------------------------------------------------

  -- Participation
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Participation Count';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 173, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Accessibility
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.79, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 82.68, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Accuracy
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.77, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 81.45, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Attitude
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Attitude Mean: Was it a nice experience? Did you receive service with a smile?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.80, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 84.08, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Operations
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Operations Mean: Do day to day operations run efficiently and effectively?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.75, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Operations Top Box: Do day to day operations run efficiently and effectively?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 79.34, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Timeliness
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Timeliness Mean: Was the response or solution delivered when promised?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.80, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Timeliness Top Box: Was the response or solution delivered when promised?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 83.02, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Add Fall 2025 to department metrics (all employees)
  -- -------------------------------------------------------

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Finance: Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.77, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Finance: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 81.51, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Human Resources: Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.79, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Human Resources: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 82.53, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Office Professionals: Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.83, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Office Professionals: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 84.98, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Technology already has Fall 2025 data (loaded from Studer report earlier)

  -- -------------------------------------------------------
  -- Add Fall 2025 to ELT characteristic metrics
  -- -------------------------------------------------------

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Participation Count';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 21, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 5.00, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 100.00, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.99, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 98.81, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Attitude Mean: Was it a nice experience? Did you receive service with a smile?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.99, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 98.81, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Operations Mean: Do day to day operations run efficiently and effectively?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.98, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Operations Top Box: Do day to day operations run efficiently and effectively?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 97.62, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Timeliness Mean: Was the response or solution delivered when promised?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.99, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Timeliness Top Box: Was the response or solution delivered when promised?';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 98.81, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Add Fall 2025 to ELT Overall metrics (adopted from Studer group)
  -- These already have Fall 2023–Spring 2025 data; add Fall 2025
  -- -------------------------------------------------------

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.99, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 98.81, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- Add Fall 2025 to BSS Overall Top Box (adopted)
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'BSS Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 82.13, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Add Fall 2025 to ELT department metrics
  -- -------------------------------------------------------

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Finance: Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.99, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Finance: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 99.05, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Human Resources: Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 4.99, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Human Resources: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 99.05, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Office Professionals: Overall Mean';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 5.00, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Office Professionals: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 100.00, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Technology: Overall Top Box';
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES (v_metric_id, 97.14, '2025-11-01', 'Fall 2025') ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Create ELT BSS Technology: Overall Mean
  -- (Top Box exists with 8 entries; Mean was never seeded)
  -- PDF data available from Fall 2023 onwards
  -- -------------------------------------------------------

  INSERT INTO metrics (name, unit, cadence, target_value, is_higher_better, data_source, collection_method)
  VALUES ('ELT BSS Technology: Overall Mean', 'mean', 'semi-annual', 4.50, true, 'BSS Survey - ELT', 'Semi-annual survey')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_metric_id FROM metrics WHERE name = 'ELT BSS Technology: Overall Mean';
  INSERT INTO metric_processes (metric_id, process_id) VALUES (v_metric_id, v_elt_process_id) ON CONFLICT DO NOTHING;
  INSERT INTO entries (metric_id, value, date, note_analysis) VALUES
    (v_metric_id, 4.87, '2023-11-01', 'Fall 2023'),
    (v_metric_id, 4.98, '2024-04-01', 'Spring 2024'),
    (v_metric_id, 4.94, '2024-11-01', 'Fall 2024'),
    (v_metric_id, 4.91, '2025-04-01', 'Spring 2025'),
    (v_metric_id, 4.97, '2025-11-01', 'Fall 2025')
  ON CONFLICT DO NOTHING;

END $$;
