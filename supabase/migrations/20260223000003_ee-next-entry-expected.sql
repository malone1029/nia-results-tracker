-- Set next_entry_expected for EE Survey metrics.
-- Spring 2026 survey results expected ~June 2026.
-- Prevents false "overdue" alerts when the 182-day semi-annual window
-- closes around early May 2026.

UPDATE metrics
  SET next_entry_expected = '2026-06-01'
  WHERE data_source IN ('EE Survey', 'Studer EE Survey')
    AND next_entry_expected IS NULL;
