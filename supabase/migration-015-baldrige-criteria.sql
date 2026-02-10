-- Migration 015: Baldrige Criteria Question Bank
-- Stores the full 2023-2024 Baldrige Excellence Framework (Business/Nonprofit)
-- criteria hierarchy: Categories → Items → Questions
-- Plus a mapping table linking processes to specific questions.

-- ============================================================
-- 1. baldrige_items — the 19 items (P.1, P.2, 1.1, 1.2, ... 7.5)
-- ============================================================
CREATE TABLE IF NOT EXISTS baldrige_items (
  id SERIAL PRIMARY KEY,
  item_code TEXT NOT NULL UNIQUE,       -- e.g. "1.1", "P.1"
  item_name TEXT NOT NULL,               -- e.g. "Senior Leadership"
  category_number INT NOT NULL,          -- 0 for P, 1-7 for categories
  category_name TEXT NOT NULL,           -- e.g. "Leadership", "Strategy"
  item_type TEXT NOT NULL CHECK (item_type IN ('profile', 'process', 'results')),
  points INT NOT NULL DEFAULT 0,         -- Baldrige point value
  sort_order INT NOT NULL DEFAULT 0
);

-- ============================================================
-- 2. baldrige_questions — sub-questions within each item
-- ============================================================
CREATE TABLE IF NOT EXISTS baldrige_questions (
  id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES baldrige_items(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL UNIQUE,    -- e.g. "1.1a(1)", "P.1b(2)"
  area_label TEXT NOT NULL,              -- e.g. "Vision and Values"
  question_text TEXT NOT NULL,           -- full question text
  question_type TEXT NOT NULL CHECK (question_type IN ('context', 'process', 'results')),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_baldrige_questions_item ON baldrige_questions(item_id);

-- ============================================================
-- 3. process_question_mappings — links processes to questions
-- ============================================================
CREATE TABLE IF NOT EXISTS process_question_mappings (
  id SERIAL PRIMARY KEY,
  process_id INT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES baldrige_questions(id) ON DELETE CASCADE,
  coverage TEXT NOT NULL DEFAULT 'primary' CHECK (coverage IN ('primary', 'supporting', 'partial')),
  notes TEXT,
  mapped_by TEXT NOT NULL DEFAULT 'manual' CHECK (mapped_by IN ('manual', 'ai_suggested', 'ai_confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate mappings of same process to same question
CREATE UNIQUE INDEX IF NOT EXISTS idx_pqm_unique ON process_question_mappings(process_id, question_id);
CREATE INDEX IF NOT EXISTS idx_pqm_question ON process_question_mappings(question_id);
CREATE INDEX IF NOT EXISTS idx_pqm_process ON process_question_mappings(process_id);

-- ============================================================
-- 4. RLS policies
-- ============================================================

-- baldrige_items: all authenticated users can read
ALTER TABLE baldrige_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read on baldrige_items"
  ON baldrige_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can modify items (via SQL Editor normally, but just in case)
CREATE POLICY "Admin write on baldrige_items"
  ON baldrige_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- baldrige_questions: all authenticated users can read
ALTER TABLE baldrige_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read on baldrige_questions"
  ON baldrige_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin write on baldrige_questions"
  ON baldrige_questions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- process_question_mappings: all authenticated users can read, admins can write
ALTER TABLE process_question_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read on process_question_mappings"
  ON process_question_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin insert on process_question_mappings"
  ON process_question_mappings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin update on process_question_mappings"
  ON process_question_mappings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin delete on process_question_mappings"
  ON process_question_mappings FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
  );
