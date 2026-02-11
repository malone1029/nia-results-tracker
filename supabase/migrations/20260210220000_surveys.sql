-- Process Surveys: 5 tables for micro-surveys linked to processes
-- Enables process owners to collect Learning dimension evidence directly

-- ============================================================
-- 1. surveys — survey metadata, linked to a process
-- ============================================================
CREATE TABLE surveys (
  id BIGSERIAL PRIMARY KEY,
  process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  is_anonymous BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read surveys"
  ON surveys FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert surveys"
  ON surveys FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update surveys"
  ON surveys FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete surveys"
  ON surveys FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. survey_questions — individual questions within a survey
-- ============================================================
CREATE TABLE survey_questions (
  id BIGSERIAL PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('rating', 'yes_no')),
  sort_order INTEGER DEFAULT 0,
  rating_scale_max INTEGER DEFAULT 5,
  metric_id INTEGER REFERENCES metrics(id) ON DELETE SET NULL
);

CREATE INDEX idx_survey_questions_survey_id ON survey_questions(survey_id);

ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read survey_questions"
  ON survey_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert survey_questions"
  ON survey_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update survey_questions"
  ON survey_questions FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete survey_questions"
  ON survey_questions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. survey_waves — each deployment of a survey
-- ============================================================
CREATE TABLE survey_waves (
  id BIGSERIAL PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  wave_number INTEGER NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  share_token TEXT UNIQUE NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  response_count INTEGER DEFAULT 0
);

CREATE INDEX idx_survey_waves_share_token ON survey_waves(share_token);

ALTER TABLE survey_waves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read survey_waves"
  ON survey_waves FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert survey_waves"
  ON survey_waves FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update survey_waves"
  ON survey_waves FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete survey_waves"
  ON survey_waves FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 4. survey_responses — one row per submission (no RLS — public access via token)
-- ============================================================
CREATE TABLE survey_responses (
  id BIGSERIAL PRIMARY KEY,
  wave_id BIGINT NOT NULL REFERENCES survey_waves(id) ON DELETE CASCADE,
  respondent_email TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS — the respond API route handles access control via share_token

-- ============================================================
-- 5. survey_answers — individual answers per response (no RLS)
-- ============================================================
CREATE TABLE survey_answers (
  id BIGSERIAL PRIMARY KEY,
  response_id BIGINT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  value_numeric REAL,
  value_text TEXT
);

CREATE INDEX idx_survey_answers_response_id ON survey_answers(response_id);

-- No RLS — the respond API route handles access control via share_token

-- ============================================================
-- 6. Anon access policies for public survey response
--    Allow anonymous users to read wave/survey/question data
--    and insert responses/answers (needed for public survey links)
-- ============================================================

-- Anon can read surveys (for public response page title/description)
CREATE POLICY "Anon can read surveys for public response"
  ON surveys FOR SELECT
  USING (is_public = true);

-- Anon can read questions (for rendering the survey form)
CREATE POLICY "Anon can read survey_questions for public response"
  ON survey_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surveys s
      WHERE s.id = survey_questions.survey_id AND s.is_public = true
    )
  );

-- Anon can read waves (to check if wave is open via share_token)
CREATE POLICY "Anon can read open survey_waves"
  ON survey_waves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM surveys s
      WHERE s.id = survey_waves.survey_id AND s.is_public = true
    )
  );

-- ============================================================
-- 7. Atomic response count increment function
--    SECURITY DEFINER bypasses RLS so anon clients can call it
-- ============================================================
CREATE OR REPLACE FUNCTION increment_wave_response_count(wave_id_input BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE survey_waves
  SET response_count = response_count + 1
  WHERE id = wave_id_input;
END;
$$;
