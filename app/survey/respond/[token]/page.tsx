'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import type { QuestionType, QuestionOptions, ConditionRule } from '@/lib/survey-types';
import { DEFAULT_RATING_LABELS } from '@/lib/survey-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Question {
  id: number;
  question_text: string;
  question_type: QuestionType;
  sort_order: number;
  rating_scale_max: number;
  options: QuestionOptions;
  is_required: boolean;
  help_text: string | null;
  section_label: string | null;
}

interface SurveyMeta {
  title: string;
  description: string | null;
  is_anonymous: boolean;
  welcome_message: string | null;
  thank_you_message: string | null;
}

// Answer state kept per question. For matrix questions we keep a map of
// row_index -> column_index so the user can answer each row independently.
interface AnswerState {
  value: number | null;
  text: string | null;
  json: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

function evaluateCondition(
  condition: ConditionRule | undefined,
  answers: Record<number, AnswerState>,
  questions: Question[]
): boolean {
  if (!condition) return true; // no condition = always visible

  // condition.question_index is 0-based into the sorted question list
  const depQuestion = questions[condition.question_index];
  if (!depQuestion) return false;

  const depAnswer = answers[depQuestion.id];
  if (!depAnswer) return false;

  const actual = depAnswer.value;
  const expected =
    typeof condition.value === 'string' ? parseFloat(condition.value) : condition.value;

  if (actual === null || actual === undefined) return false;

  switch (condition.operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'greater_than':
      return actual > expected;
    case 'less_than':
      return actual < expected;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SurveyRespondPage() {
  const params = useParams();
  const token = params.token as string;

  const [survey, setSurvey] = useState<SurveyMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [waveId, setWaveId] = useState<number | null>(null);
  // answers keyed by question id
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  // matrix answers: key = `${questionId}-${rowIndex}`, value = column index
  const [matrixAnswers, setMatrixAnswers] = useState<Record<string, number>>({});
  // checkbox selections: key = questionId, value = Set of selected indices
  const [checkboxSelections, setCheckboxSelections] = useState<Record<number, Set<number>>>({});
  // "Other" text for multiple_choice and checkbox
  const [otherText, setOtherText] = useState<Record<number, string>>({});

  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);

  // -----------------------------------------------------------------------
  // Load survey
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function loadSurvey() {
      try {
        const res = await fetch(`/api/surveys/respond?token=${token}`);
        if (res.status === 410) {
          setClosed(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('Survey not found');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setSurvey(data.survey);
        setQuestions(data.questions);
        setWaveId(data.wave_id);
      } catch {
        setError('Failed to load survey');
      }
      setLoading(false);
    }
    loadSurvey();
  }, [token]);

  // -----------------------------------------------------------------------
  // Visibility — which questions are hidden by conditions
  // -----------------------------------------------------------------------
  const visibleQuestions = useMemo(() => {
    return questions.filter((q) => evaluateCondition(q.options?.condition, answers, questions));
  }, [questions, answers]);

  const hiddenQuestionIds = useMemo(() => {
    const visibleIds = new Set(visibleQuestions.map((q) => q.id));
    return questions.filter((q) => !visibleIds.has(q.id)).map((q) => q.id);
  }, [questions, visibleQuestions]);

  // -----------------------------------------------------------------------
  // Progress — count required visible questions that are answered
  // -----------------------------------------------------------------------
  const requiredVisible = useMemo(
    () => visibleQuestions.filter((q) => q.is_required),
    [visibleQuestions]
  );

  const answeredRequiredCount = useMemo(() => {
    return requiredVisible.filter((q) => {
      if (q.question_type === 'matrix') {
        const rows = q.options?.rows || [];
        return rows.every((_, ri) => matrixAnswers[`${q.id}-${ri}`] !== undefined);
      }
      if (q.question_type === 'checkbox') {
        const sel = checkboxSelections[q.id];
        return sel && sel.size > 0;
      }
      const a = answers[q.id];
      if (!a) return false;
      if (q.question_type === 'open_text') return !!a.text?.trim();
      return a.value !== null && a.value !== undefined;
    }).length;
  }, [requiredVisible, answers, matrixAnswers, checkboxSelections]);

  const progressPct =
    requiredVisible.length > 0 ? (answeredRequiredCount / requiredVisible.length) * 100 : 0;

  // -----------------------------------------------------------------------
  // Answer helpers
  // -----------------------------------------------------------------------
  const setAnswer = useCallback(
    (questionId: number, value: number | null, text?: string | null) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          value,
          text: text ?? prev[questionId]?.text ?? null,
          json: prev[questionId]?.json ?? null,
        },
      }));
    },
    []
  );

  const setAnswerText = useCallback((questionId: number, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value: prev[questionId]?.value ?? null,
        text,
        json: prev[questionId]?.json ?? null,
      },
    }));
  }, []);

  const toggleCheckbox = useCallback((questionId: number, index: number) => {
    setCheckboxSelections((prev) => {
      const current = new Set(prev[questionId] || []);
      if (current.has(index)) {
        current.delete(index);
      } else {
        current.add(index);
      }
      return { ...prev, [questionId]: current };
    });
  }, []);

  const setMatrixCell = useCallback((questionId: number, rowIndex: number, colIndex: number) => {
    setMatrixAnswers((prev) => ({
      ...prev,
      [`${questionId}-${rowIndex}`]: colIndex,
    }));
  }, []);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------
  async function handleSubmit() {
    // Validate required visible questions
    const unansweredRequired = requiredVisible.filter((q) => {
      if (q.question_type === 'matrix') {
        const rows = q.options?.rows || [];
        return !rows.every((_, ri) => matrixAnswers[`${q.id}-${ri}`] !== undefined);
      }
      if (q.question_type === 'checkbox') {
        const sel = checkboxSelections[q.id];
        return !sel || sel.size === 0;
      }
      const a = answers[q.id];
      if (!a) return true;
      if (q.question_type === 'open_text') return !a.text?.trim();
      return a.value === null || a.value === undefined;
    });

    if (unansweredRequired.length > 0) {
      setError(`Please answer all required questions (${unansweredRequired.length} remaining)`);
      // Scroll to first unanswered
      const firstId = unansweredRequired[0].id;
      const el = document.getElementById(`question-${firstId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setError('');
    setSubmitting(true);

    // Build answer payloads for visible questions
    const answerPayloads: Array<{
      questionId: number;
      value: number | null;
      text: string | null;
      json: Record<string, unknown> | null;
    }> = [];

    for (const q of visibleQuestions) {
      if (q.question_type === 'matrix') {
        // One answer per row
        const rows = q.options?.rows || [];
        rows.forEach((rowLabel, ri) => {
          const colIdx = matrixAnswers[`${q.id}-${ri}`];
          if (colIdx !== undefined) {
            answerPayloads.push({
              questionId: q.id,
              value: colIdx,
              text: null,
              json: { row_index: ri, row_label: rowLabel },
            });
          }
        });
      } else if (q.question_type === 'checkbox') {
        const sel = checkboxSelections[q.id];
        if (sel && sel.size > 0) {
          const selectedArr = Array.from(sel).sort((a, b) => a - b);
          answerPayloads.push({
            questionId: q.id,
            value: selectedArr.length,
            text: otherText[q.id]?.trim() || null,
            json: { selected: selectedArr },
          });
        }
      } else if (q.question_type === 'open_text') {
        const a = answers[q.id];
        if (a?.text?.trim()) {
          answerPayloads.push({
            questionId: q.id,
            value: null,
            text: a.text.trim(),
            json: null,
          });
        }
      } else if (q.question_type === 'multiple_choice') {
        const a = answers[q.id];
        if (a && a.value !== null && a.value !== undefined) {
          answerPayloads.push({
            questionId: q.id,
            value: a.value,
            text: otherText[q.id]?.trim() || null,
            json: null,
          });
        }
      } else {
        // rating, yes_no, nps
        const a = answers[q.id];
        if (a && a.value !== null && a.value !== undefined) {
          answerPayloads.push({
            questionId: q.id,
            value: a.value,
            text: a.text || null,
            json: null,
          });
        }
      }
    }

    // Attach comment to last question's text if present
    if (comment.trim() && answerPayloads.length > 0) {
      const lastIdx = answerPayloads.length - 1;
      if (!answerPayloads[lastIdx].text) {
        answerPayloads[lastIdx].text = comment.trim();
      }
    }

    try {
      const res = await fetch('/api/surveys/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          answers: answerPayloads,
          email: email.trim() || undefined,
          hiddenQuestionIds,
        }),
      });

      if (!res.ok) {
        if (res.status === 410) {
          setClosed(true);
          setSubmitting(false);
          return;
        }
        const data = await res.json();
        setError(data.error || 'Failed to submit');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    }
    setSubmitting(false);
  }

  // -----------------------------------------------------------------------
  // Render states: loading, closed, fatal error, submitted
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-hover flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-border border-t-text-secondary rounded-full" />
      </div>
    );
  }

  if (closed) {
    return (
      <div className="min-h-screen bg-surface-hover flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-sm border border-border max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-subtle flex items-center justify-center">
            <svg
              className="w-6 h-6 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Survey Closed</h1>
          <p className="text-text-tertiary">This survey is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-surface-hover flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-sm border border-border max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Oops</h1>
          <p className="text-text-tertiary">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-hover flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-sm border border-border max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Thank You!</h1>
          <p className="text-text-tertiary">
            {survey?.thank_you_message || 'Your response has been recorded.'}
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Visible question numbering (skip hidden ones in the counter)
  // -----------------------------------------------------------------------
  let visibleIndex = 0;

  // -----------------------------------------------------------------------
  // Main form
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-surface-hover">
      {/* Sticky header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="NIA"
                width={32}
                height={32}
                className="h-7 sm:h-8 w-auto"
              />
              <span className="text-xs text-text-muted uppercase tracking-wider font-medium hidden sm:inline">
                Process Survey
              </span>
            </div>
            <span className="text-xs text-text-muted tabular-nums">
              {answeredRequiredCount} / {requiredVisible.length} required answered
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{survey?.title}</h1>
          {survey?.description && (
            <p className="text-text-secondary mt-1 text-sm sm:text-base">{survey.description}</p>
          )}
          {/* Progress bar */}
          <div className="h-1 bg-surface-subtle rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome message */}
        {survey?.welcome_message && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <p className="text-text-secondary text-sm sm:text-base whitespace-pre-line">
              {survey.welcome_message}
            </p>
          </div>
        )}

        {questions.map((q) => {
          const isVisible = evaluateCondition(q.options?.condition, answers, questions);

          // Track numbering only for visible questions
          if (isVisible) visibleIndex++;
          const displayNum = visibleIndex;

          return (
            <div
              key={q.id}
              id={`question-${q.id}`}
              className={`transition-all duration-300 ease-in-out ${
                isVisible
                  ? 'opacity-100 max-h-[2000px] scale-100'
                  : 'opacity-0 max-h-0 scale-95 overflow-hidden pointer-events-none'
              }`}
            >
              {/* Section divider */}
              {q.section_label && isVisible && (
                <div className="mb-4 pt-2">
                  <div className="border-l-4 border-[#2d3c34] pl-4">
                    <h3 className="text-lg font-semibold text-foreground">{q.section_label}</h3>
                  </div>
                </div>
              )}

              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                {/* Question header */}
                <div className="flex gap-3 mb-1">
                  <span className="text-sm font-bold text-text-muted mt-0.5 flex-shrink-0">
                    {displayNum}
                    {q.is_required && <span className="text-red-500 ml-0.5">*</span>}
                  </span>
                  <h2 className="text-base font-medium text-foreground">{q.question_text}</h2>
                </div>

                {/* Help text */}
                {q.help_text && <p className="ml-7 mb-3 text-sm text-text-muted">{q.help_text}</p>}

                {/* Render the appropriate input based on question type */}
                <div className="ml-7 mt-3">
                  {q.question_type === 'rating' && (
                    <RatingInput
                      question={q}
                      value={answers[q.id]?.value ?? null}
                      onChange={(val) => setAnswer(q.id, val)}
                    />
                  )}
                  {q.question_type === 'yes_no' && (
                    <YesNoInput
                      value={answers[q.id]?.value ?? null}
                      onChange={(val) => setAnswer(q.id, val)}
                    />
                  )}
                  {q.question_type === 'nps' && (
                    <NpsInput
                      value={answers[q.id]?.value ?? null}
                      onChange={(val) => setAnswer(q.id, val)}
                    />
                  )}
                  {q.question_type === 'multiple_choice' && (
                    <MultipleChoiceInput
                      question={q}
                      value={answers[q.id]?.value ?? null}
                      otherText={otherText[q.id] || ''}
                      onChange={(val) => setAnswer(q.id, val)}
                      onOtherTextChange={(t) => setOtherText((prev) => ({ ...prev, [q.id]: t }))}
                    />
                  )}
                  {q.question_type === 'checkbox' && (
                    <CheckboxInput
                      question={q}
                      selected={checkboxSelections[q.id] || new Set()}
                      otherText={otherText[q.id] || ''}
                      onToggle={(idx) => toggleCheckbox(q.id, idx)}
                      onOtherTextChange={(t) => setOtherText((prev) => ({ ...prev, [q.id]: t }))}
                    />
                  )}
                  {q.question_type === 'open_text' && (
                    <OpenTextInput
                      question={q}
                      value={answers[q.id]?.text || ''}
                      onChange={(t) => setAnswerText(q.id, t)}
                    />
                  )}
                  {q.question_type === 'matrix' && (
                    <MatrixInput
                      question={q}
                      matrixAnswers={matrixAnswers}
                      onChange={(ri, ci) => setMatrixCell(q.id, ri, ci)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Optional comment */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h2 className="text-base font-medium text-foreground mb-3">
            Additional Comments{' '}
            <span className="text-text-muted font-normal text-sm">(optional)</span>
          </h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Any additional feedback..."
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#2d3c34]/20 focus:border-[#2d3c34] resize-none"
          />
        </div>

        {/* Email (if not anonymous) */}
        {survey && !survey.is_anonymous && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="text-base font-medium text-foreground mb-3">Your Email</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#2d3c34]/20 focus:border-[#2d3c34]"
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#2d3c34] text-white py-3.5 rounded-xl text-base font-semibold hover:bg-[#3d4c44] transition-colors disabled:opacity-50 shadow-md"
        >
          {submitting ? 'Submitting...' : 'Submit Response'}
        </button>

        <p className="text-center text-xs text-text-muted pb-8">
          {survey?.is_anonymous
            ? 'Your response is anonymous.'
            : 'Your email will be recorded with your response.'}
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components for each question type
// ===========================================================================

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------
function RatingInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: number | null;
  onChange: (val: number) => void;
}) {
  const max = question.rating_scale_max || 5;
  const labels = question.options?.labels || DEFAULT_RATING_LABELS[max] || [];
  const isCompact = max >= 7;

  return (
    <div>
      <div className={`flex ${isCompact ? 'gap-1' : 'gap-2'} flex-wrap`}>
        {Array.from({ length: max }, (_, i) => i + 1).map((val) => {
          const label = labels[val - 1];
          const useTextLabel = !isCompact && label;

          return (
            <button
              key={val}
              onClick={() => onChange(val)}
              className={`rounded-lg font-semibold transition-all text-center ${
                isCompact
                  ? 'w-9 h-9 text-sm'
                  : useTextLabel
                    ? 'flex-1 min-w-0 py-2.5 px-1 text-xs leading-tight'
                    : 'w-12 h-12 text-lg'
              } ${
                value === val
                  ? 'bg-[#2d3c34] text-white shadow-md scale-105'
                  : 'bg-surface-subtle text-text-secondary hover:bg-surface-muted'
              }`}
              title={label || String(val)}
            >
              {useTextLabel ? label : val}
            </button>
          );
        })}
      </div>
      {/* Show end labels for compact scales (7, 10) */}
      {isCompact && labels.length >= 2 && (
        <div className="flex justify-between mt-2">
          <span className="text-xs text-text-muted">{labels[0]}</span>
          <span className="text-xs text-text-muted">{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yes / No
// ---------------------------------------------------------------------------
function YesNoInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange(1)}
        className={`flex-1 py-3 rounded-lg text-base font-medium transition-all ${
          value === 1
            ? 'bg-green-600 text-white shadow-md'
            : 'bg-surface-subtle text-text-secondary hover:bg-surface-muted'
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => onChange(0)}
        className={`flex-1 py-3 rounded-lg text-base font-medium transition-all ${
          value === 0
            ? 'bg-red-500 text-white shadow-md'
            : 'bg-surface-subtle text-text-secondary hover:bg-surface-muted'
        }`}
      >
        No
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NPS (0-10)
// ---------------------------------------------------------------------------
function NpsInput({ value, onChange }: { value: number | null; onChange: (val: number) => void }) {
  function getNpsColor(score: number, isSelected: boolean): string {
    if (!isSelected) return 'bg-surface-subtle text-text-secondary hover:bg-surface-muted';
    if (score <= 6) return 'bg-red-500 text-white shadow-md';
    if (score <= 8) return 'bg-yellow-500 text-white shadow-md';
    return 'bg-green-600 text-white shadow-md';
  }

  function getNpsBorderColor(score: number): string {
    if (score <= 6) return 'border-red-200';
    if (score <= 8) return 'border-yellow-200';
    return 'border-green-200';
  }

  return (
    <div>
      {/* Buttons: 0-10 */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => i).map((score) => (
          <button
            key={score}
            onClick={() => onChange(score)}
            className={`w-[calc(9.09%-3px)] min-w-[28px] h-9 rounded-lg text-sm font-semibold transition-all border ${
              value === score
                ? getNpsColor(score, true)
                : `${getNpsColor(score, false)} ${getNpsBorderColor(score)}`
            }`}
          >
            {score}
          </button>
        ))}
      </div>

      {/* End labels */}
      <div className="flex justify-between mt-2">
        <span className="text-xs text-text-muted">Not at all likely</span>
        <span className="text-xs text-text-muted">Extremely likely</span>
      </div>

      {/* Segment labels */}
      <div className="flex justify-between mt-1 text-[10px]">
        <span className="text-red-400">Detractor (0-6)</span>
        <span className="text-yellow-500">Passive (7-8)</span>
        <span className="text-green-500">Promoter (9-10)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple Choice (radio-style, single select)
// ---------------------------------------------------------------------------
function MultipleChoiceInput({
  question,
  value,
  otherText,
  onChange,
  onOtherTextChange,
}: {
  question: Question;
  value: number | null;
  otherText: string;
  onChange: (val: number) => void;
  onOtherTextChange: (text: string) => void;
}) {
  const choices = question.options?.choices || [];
  const allowOther = question.options?.allow_other || false;
  const otherIndex = choices.length; // "Other" gets the next index

  return (
    <div className="space-y-2">
      {choices.map((choice, idx) => (
        <button
          key={idx}
          onClick={() => onChange(idx)}
          className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${
            value === idx
              ? 'border-[#2d3c34] bg-[#2d3c34]/5 ring-1 ring-[#2d3c34]'
              : 'border-border bg-surface-subtle hover:bg-surface-muted'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              value === idx ? 'border-[#2d3c34]' : 'border-gray-300'
            }`}
          >
            {value === idx && <span className="w-2.5 h-2.5 rounded-full bg-[#2d3c34]" />}
          </span>
          <span className="text-sm text-foreground">{choice}</span>
        </button>
      ))}

      {allowOther && (
        <div>
          <button
            onClick={() => onChange(otherIndex)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${
              value === otherIndex
                ? 'border-[#2d3c34] bg-[#2d3c34]/5 ring-1 ring-[#2d3c34]'
                : 'border-border bg-surface-subtle hover:bg-surface-muted'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                value === otherIndex ? 'border-[#2d3c34]' : 'border-gray-300'
              }`}
            >
              {value === otherIndex && <span className="w-2.5 h-2.5 rounded-full bg-[#2d3c34]" />}
            </span>
            <span className="text-sm text-foreground">Other</span>
          </button>
          {value === otherIndex && (
            <input
              type="text"
              value={otherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              placeholder="Please specify..."
              autoFocus
              className="mt-2 ml-8 w-[calc(100%-2rem)] border border-border rounded-lg px-3 py-2 text-sm text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#2d3c34]/20 focus:border-[#2d3c34]"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkbox (multi-select)
// ---------------------------------------------------------------------------
function CheckboxInput({
  question,
  selected,
  otherText,
  onToggle,
  onOtherTextChange,
}: {
  question: Question;
  selected: Set<number>;
  otherText: string;
  onToggle: (idx: number) => void;
  onOtherTextChange: (text: string) => void;
}) {
  const choices = question.options?.choices || [];
  const allowOther = question.options?.allow_other || false;
  const otherIndex = choices.length;

  return (
    <div className="space-y-2">
      {choices.map((choice, idx) => {
        const isChecked = selected.has(idx);
        return (
          <button
            key={idx}
            onClick={() => onToggle(idx)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${
              isChecked
                ? 'border-[#2d3c34] bg-[#2d3c34]/5 ring-1 ring-[#2d3c34]'
                : 'border-border bg-surface-subtle hover:bg-surface-muted'
            }`}
          >
            <span
              className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                isChecked ? 'border-[#2d3c34] bg-[#2d3c34]' : 'border-gray-300'
              }`}
            >
              {isChecked && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-sm text-foreground">{choice}</span>
          </button>
        );
      })}

      {allowOther && (
        <div>
          <button
            onClick={() => onToggle(otherIndex)}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${
              selected.has(otherIndex)
                ? 'border-[#2d3c34] bg-[#2d3c34]/5 ring-1 ring-[#2d3c34]'
                : 'border-border bg-surface-subtle hover:bg-surface-muted'
            }`}
          >
            <span
              className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                selected.has(otherIndex) ? 'border-[#2d3c34] bg-[#2d3c34]' : 'border-gray-300'
              }`}
            >
              {selected.has(otherIndex) && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-sm text-foreground">Other</span>
          </button>
          {selected.has(otherIndex) && (
            <input
              type="text"
              value={otherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              placeholder="Please specify..."
              autoFocus
              className="mt-2 ml-8 w-[calc(100%-2rem)] border border-border rounded-lg px-3 py-2 text-sm text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#2d3c34]/20 focus:border-[#2d3c34]"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Open Text
// ---------------------------------------------------------------------------
function OpenTextInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (text: string) => void;
}) {
  const variant = question.options?.variant || 'long';
  const maxLength = question.options?.max_length;

  if (variant === 'short') {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (maxLength && e.target.value.length > maxLength) return;
            onChange(e.target.value);
          }}
          placeholder="Type your answer..."
          className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#2d3c34]/20 focus:border-[#2d3c34]"
        />
        {maxLength && (
          <div className="text-right mt-1">
            <span
              className={`text-xs ${value.length > maxLength * 0.9 ? 'text-red-500' : 'text-text-muted'}`}
            >
              {value.length} / {maxLength}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => {
          if (maxLength && e.target.value.length > maxLength) return;
          onChange(e.target.value);
        }}
        placeholder="Type your answer..."
        rows={4}
        className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-text-secondary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#2d3c34]/20 focus:border-[#2d3c34] resize-y"
      />
      {maxLength && (
        <div className="text-right mt-1">
          <span
            className={`text-xs ${value.length > maxLength * 0.9 ? 'text-red-500' : 'text-text-muted'}`}
          >
            {value.length} / {maxLength}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix / Grid
// ---------------------------------------------------------------------------
function MatrixInput({
  question,
  matrixAnswers,
  onChange,
}: {
  question: Question;
  matrixAnswers: Record<string, number>;
  onChange: (rowIndex: number, colIndex: number) => void;
}) {
  const rows = question.options?.rows || [];
  const columns = question.options?.columns || [];

  if (rows.length === 0 || columns.length === 0) {
    return <p className="text-sm text-text-muted">Matrix not configured.</p>;
  }

  return (
    <div>
      {/* Desktop: grid table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 font-medium text-text-muted w-1/3" />
              {columns.map((col, ci) => (
                <th key={ci} className="text-center py-2 px-2 font-medium text-text-muted text-xs">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const selectedCol = matrixAnswers[`${question.id}-${ri}`];
              return (
                <tr key={ri} className="border-t border-border/50">
                  <td className="py-3 pr-4 text-foreground font-medium text-sm">{row}</td>
                  {columns.map((_, ci) => (
                    <td key={ci} className="text-center py-3 px-2">
                      <button
                        onClick={() => onChange(ri, ci)}
                        className={`w-7 h-7 rounded-full border-2 transition-all mx-auto flex items-center justify-center ${
                          selectedCol === ci
                            ? 'border-[#2d3c34] bg-[#2d3c34]'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selectedCol === ci && (
                          <span className="w-2.5 h-2.5 rounded-full bg-white" />
                        )}
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards per row */}
      <div className="sm:hidden space-y-4">
        {rows.map((row, ri) => {
          const selectedCol = matrixAnswers[`${question.id}-${ri}`];
          return (
            <div key={ri} className="border border-border/50 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground mb-2">{row}</p>
              <div className="flex gap-1.5 flex-wrap">
                {columns.map((col, ci) => (
                  <button
                    key={ci}
                    onClick={() => onChange(ri, ci)}
                    className={`flex-1 min-w-0 py-2 px-1 rounded-lg text-xs font-medium transition-all text-center leading-tight ${
                      selectedCol === ci
                        ? 'bg-[#2d3c34] text-white shadow-md'
                        : 'bg-surface-subtle text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
