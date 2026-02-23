-- Add next_entry_expected to metrics.
-- Allows owners/admins to declare when they expect the next survey result,
-- preventing false "overdue" alerts for calendar-scheduled surveys (MDS, BSS)
-- that don't follow a fixed interval cadence.

-- ============================================================
-- 1. Add column
-- ============================================================
ALTER TABLE metrics
  ADD COLUMN IF NOT EXISTS next_entry_expected DATE;

-- ============================================================
-- 2. Pre-seed for MDS and BSS survey metrics
--    Spring 2026 survey results expected ~June 2026
-- ============================================================
UPDATE metrics
  SET next_entry_expected = '2026-06-01'
  WHERE data_source IN ('MDS Survey', 'BSS Survey', 'BSS Survey - ELT')
    AND next_entry_expected IS NULL;

-- ============================================================
-- 3. Add missing Oct 2025 entries for existing MDS metrics
--    The rename migration (20260222010000) only added Oct 2025
--    entries for newly-created metrics. These pre-existing ones
--    were renamed but never received their Fall 2025 data.
-- ============================================================

-- Characteristic Means
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.81, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Accessibility Mean: Can you reach a live person or use an electronic tool to reach someone?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.78, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Accuracy Mean: Did you receive the right product/service or was an alternative communicated?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.89, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Attitude Mean: Was it a nice experience? Did you receive service with a smile?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.80, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Operations Mean: Do day to day operations run efficiently and effectively?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Timeliness Mean: Was the response or solution delivered when promised?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 22, '2025-10-01', 'Oct 2025 — 22 respondents' FROM metrics
WHERE name = 'MDS Participation Count'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

-- Characteristic Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.54, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Accessibility Top Box: Can you reach a live person or use an electronic tool to reach someone?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 82.28, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Accuracy Top Box: Did you receive the right product/service or was an alternative communicated?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 89.87, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Attitude Top Box: Was it a nice experience? Did you receive service with a smile?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.54, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Operations Top Box: Do day to day operations run efficiently and effectively?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 87.01, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Timeliness Top Box: Was the response or solution delivered when promised?'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

-- Department Means
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.70, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Audiology: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.70, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.83, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Occupational and Physical Therapy: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.71, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Speech Therapy: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.99, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.95, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Billing and Invoicing: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 4.96, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Mean'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

-- Department Top Box
INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 70.00, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Audiology: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 81.48, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Deaf/Hard of Hearing Itinerant: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 83.33, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Occupational and Physical Therapy: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 71.43, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Speech Therapy: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 98.67, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Vision, Orientation and Mobility (O&M) and CATIS: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 95.00, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Billing and Invoicing: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');

INSERT INTO entries (metric_id, value, date, note_analysis)
SELECT id, 96.00, '2025-10-01', 'Oct 2025' FROM metrics
WHERE name = 'MDS Needs Assessment, Recommendations and Change Forms: Overall Top Box'
  AND NOT EXISTS (SELECT 1 FROM entries WHERE metric_id = metrics.id AND date = '2025-10-01');
