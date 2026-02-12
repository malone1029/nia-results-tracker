-- Improvement Journal: user-authored entries recording real process changes.
-- Separate from process_improvements (auto-generated edit log from AI applies).

CREATE TABLE IF NOT EXISTS improvement_journal (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  process_id INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  asana_task_url TEXT,          -- set after Asana export
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_improvement_journal_process ON improvement_journal(process_id);
ALTER TABLE improvement_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_select" ON improvement_journal FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "journal_insert" ON improvement_journal FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "journal_update" ON improvement_journal FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "journal_delete" ON improvement_journal FOR DELETE USING (auth.uid() IS NOT NULL);
