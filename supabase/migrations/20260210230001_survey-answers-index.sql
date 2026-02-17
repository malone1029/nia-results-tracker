-- Add missing index on survey_answers.question_id for results aggregation queries
CREATE INDEX IF NOT EXISTS idx_survey_answers_question_id ON survey_answers(question_id);
