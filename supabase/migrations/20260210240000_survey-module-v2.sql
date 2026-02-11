-- Survey Module v2: New question types, options, sections, templates
-- Supports: rating, yes_no, nps, multiple_choice, checkbox, open_text, matrix
-- Backward compatible — all existing surveys continue to work

-- ============================================================
-- 1. Expand survey_questions — new columns + question types
-- ============================================================

-- Drop the old CHECK constraint and add expanded one
ALTER TABLE survey_questions DROP CONSTRAINT IF EXISTS survey_questions_question_type_check;
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_question_type_check
  CHECK (question_type IN ('rating', 'yes_no', 'nps', 'multiple_choice', 'checkbox', 'open_text', 'matrix'));

-- Options JSONB — stores type-specific config:
--   rating:          { "labels": ["Never", "Rarely", "Sometimes", "Often", "Always"] }
--   multiple_choice: { "choices": ["A", "B", "C"], "allow_other": true }
--   checkbox:        { "choices": ["A", "B", "C"], "allow_other": true }
--   open_text:       { "variant": "short"|"long", "max_length": 500 }
--   nps:             {} (standardized 0-10)
--   matrix:          { "rows": ["Row 1", ...], "columns": ["Col 1", ...] }
--   yes_no:          {} (no options needed)
--   Skip logic:      { "condition": { "question_index": N, "operator": "equals"|"not_equals"|"greater_than"|"less_than", "value": any } }
ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}';

-- Required flag (default true for backward compatibility)
ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;

-- Help text shown below question on response page
ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS help_text TEXT;

-- Section label — first question in a section gets the label, groups visually
ALTER TABLE survey_questions ADD COLUMN IF NOT EXISTS section_label TEXT;

-- ============================================================
-- 2. Expand survey_answers — JSONB for complex answer types
-- ============================================================

-- value_json stores structured answers:
--   checkbox: { "selected": [0, 2, 4] }
--   matrix:   { "row_index": 0, "row_label": "Timeliness" }
ALTER TABLE survey_answers ADD COLUMN IF NOT EXISTS value_json JSONB;

-- ============================================================
-- 3. Expand surveys — custom messages
-- ============================================================

-- Welcome message shown at top of survey form
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Thank-you message shown after submission (replaces default "Your response has been recorded")
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS thank_you_message TEXT;

-- ============================================================
-- 4. Survey templates — reusable question sets
-- ============================================================

CREATE TABLE IF NOT EXISTS survey_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Custom',
  questions JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read own templates + shared templates
CREATE POLICY "Users can read own and shared templates"
  ON survey_templates FOR SELECT
  USING (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR is_shared = true));

-- Authenticated users can create templates
CREATE POLICY "Users can create templates"
  ON survey_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update own templates, admins can update shared
CREATE POLICY "Users can update own templates"
  ON survey_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR is_admin()));

-- Users can delete own templates, admins can delete any
CREATE POLICY "Users can delete own templates"
  ON survey_templates FOR DELETE
  USING (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR is_admin()));

-- ============================================================
-- 5. Seed starter templates
-- ============================================================

INSERT INTO survey_templates (name, description, category, questions, is_shared) VALUES
(
  'Process Satisfaction',
  '5 questions measuring stakeholder satisfaction with a process',
  'Process Effectiveness',
  '[
    {"question_text": "Overall, how satisfied are you with this process?", "question_type": "rating", "options": {"labels": ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]}, "is_required": true},
    {"question_text": "The process is completed in a timely manner.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "The quality of the output meets expectations.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "Communication throughout the process is clear and timely.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "How likely are you to recommend this process to a colleague?", "question_type": "nps", "options": {}, "is_required": true}
  ]'::jsonb,
  true
),
(
  'Employee Engagement Quick Pulse',
  '5 questions for a quick check on team engagement and satisfaction',
  'Employee Engagement',
  '[
    {"question_text": "I am satisfied with my role and responsibilities.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "My manager provides the support I need to do my job well.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "I feel recognized for my contributions.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "I see opportunities for growth and development here.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "How likely are you to recommend this as a great place to work?", "question_type": "nps", "options": {}, "is_required": true}
  ]'::jsonb,
  true
),
(
  'Service Feedback',
  '6 questions collecting feedback on a specific service with mixed question types',
  'Member Satisfaction',
  '[
    {"question_text": "Which service are you providing feedback on?", "question_type": "multiple_choice", "options": {"choices": ["Professional Development", "Curriculum Support", "Technology Services", "Business Services", "Other"], "allow_other": true}, "is_required": true},
    {"question_text": "How easy was it to access this service?", "question_type": "rating", "options": {"labels": ["Very Difficult", "Difficult", "Neutral", "Easy", "Very Easy"]}, "is_required": true},
    {"question_text": "The service was responsive to my needs.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "The outcome met or exceeded my expectations.", "question_type": "rating", "options": {"labels": ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]}, "is_required": true},
    {"question_text": "How likely are you to recommend this service?", "question_type": "nps", "options": {}, "is_required": true},
    {"question_text": "What could we improve?", "question_type": "open_text", "options": {"variant": "long"}, "is_required": false}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
