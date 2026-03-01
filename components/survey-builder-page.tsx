'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  QuestionInput,
  QuestionType,
  QuestionOptions,
  QUESTION_TYPES,
  RATING_SCALE_OPTIONS,
  DEFAULT_RATING_LABELS,
  createEmptyQuestion,
} from '@/lib/survey-types';
import { Button, Input, Badge, Textarea } from '@/components/ui';

/* ─── Types ─────────────────────────────────────────────────── */

interface MetricOption {
  id: number;
  name: string;
  unit: string;
  cadence: string;
}

interface SurveyData {
  id: number;
  process_id: number;
  title: string;
  description: string | null;
  is_anonymous: boolean;
  welcome_message: string | null;
  thank_you_message: string | null;
  questions: QuestionInput[];
  response_target?: number | null;
  recurrence_enabled?: boolean;
  recurrence_cadence?: string | null;
  recurrence_duration_days?: number;
}

interface SurveyBuilderPageProps {
  processId: number;
  metrics: MetricOption[];
  /** If provided, the builder operates in edit mode */
  existingSurvey?: SurveyData;
  /** Pre-populated questions from a template or AI generation */
  initialQuestions?: QuestionInput[];
}

/* ─── Question type badge colors ─────────────────────────────── */

const TYPE_BADGE_COLORS: Record<
  QuestionType,
  'orange' | 'green' | 'purple' | 'blue' | 'dark' | 'red' | 'yellow'
> = {
  rating: 'orange',
  yes_no: 'green',
  nps: 'purple',
  multiple_choice: 'blue',
  checkbox: 'dark',
  open_text: 'yellow',
  matrix: 'red',
};

/* ─── Icons (inline SVG) ─────────────────────────────────────── */

function ChevronUpIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function GripIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

function ArrowLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

/* ─── Editable List (for choices, matrix rows/cols) ──────────── */

function EditableList({
  items,
  onChange,
  placeholder,
  minItems = 2,
  addLabel = 'Add option',
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  minItems?: number;
  addLabel?: string;
}) {
  function updateItem(index: number, value: string) {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  }

  function removeItem(index: number) {
    if (items.length <= minItems) return;
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, '']);
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === items.length - 1))
      return;
    const updated = [...items];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    onChange(updated);
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted w-5 text-right flex-shrink-0">{i + 1}.</span>
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={`${placeholder} ${i + 1}`}
            className="flex-1 border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground bg-card placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue"
          />
          <button
            onClick={() => moveItem(i, 'up')}
            disabled={i === 0}
            className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"
            title="Move up"
          >
            <ChevronUpIcon className="w-3 h-3" />
          </button>
          <button
            onClick={() => moveItem(i, 'down')}
            disabled={i === items.length - 1}
            className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"
            title="Move down"
          >
            <ChevronDownIcon className="w-3 h-3" />
          </button>
          {items.length > minItems && (
            <button
              onClick={() => removeItem(i)}
              className="p-1 text-text-muted hover:text-nia-red"
              title="Remove"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium mt-1"
      >
        + {addLabel}
      </button>
    </div>
  );
}

/* ─── Condition Builder ──────────────────────────────────────── */

function ConditionBuilder({
  condition,
  onChange,
  onRemove,
  questions,
  currentIndex,
}: {
  condition: QuestionOptions['condition'];
  onChange: (condition: QuestionOptions['condition']) => void;
  onRemove: () => void;
  questions: QuestionInput[];
  currentIndex: number;
}) {
  // Only show previous questions as sources
  const availableQuestions = questions
    .map((q, i) => ({ ...q, originalIndex: i }))
    .filter((q, i) => i < currentIndex && q.question_text.trim());

  if (availableQuestions.length === 0) {
    return (
      <p className="text-xs text-text-muted italic">
        No previous questions available for conditions.
      </p>
    );
  }

  const sourceQuestion = condition ? questions[condition.question_index] : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-secondary font-medium">Show only if</span>
      <select
        value={condition?.question_index ?? ''}
        onChange={(e) => {
          const idx = Number(e.target.value);
          onChange({
            question_index: idx,
            operator: 'equals',
            value: '',
          });
        }}
        className="border border-border rounded-md px-2 py-1 text-xs bg-card text-text-secondary min-w-[120px]"
      >
        <option value="">Select question...</option>
        {availableQuestions.map((q) => (
          <option key={q.originalIndex} value={q.originalIndex}>
            Q{q.originalIndex + 1}: {q.question_text.slice(0, 40)}
            {q.question_text.length > 40 ? '...' : ''}
          </option>
        ))}
      </select>

      <select
        value={condition?.operator ?? 'equals'}
        onChange={(e) =>
          condition &&
          onChange({
            ...condition,
            operator: e.target.value as 'equals' | 'not_equals' | 'greater_than' | 'less_than',
          })
        }
        className="border border-border rounded-md px-2 py-1 text-xs bg-card text-text-secondary"
        disabled={!condition?.question_index && condition?.question_index !== 0}
      >
        <option value="equals">equals</option>
        <option value="not_equals">not equals</option>
        <option value="greater_than">greater than</option>
        <option value="less_than">less than</option>
      </select>

      {/* Value input — adapts based on source question type */}
      {sourceQuestion?.question_type === 'yes_no' ? (
        <select
          value={String(condition?.value ?? '')}
          onChange={(e) => condition && onChange({ ...condition, value: e.target.value })}
          className="border border-border rounded-md px-2 py-1 text-xs bg-card text-text-secondary"
        >
          <option value="">Select...</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      ) : sourceQuestion?.question_type === 'multiple_choice' ||
        sourceQuestion?.question_type === 'checkbox' ? (
        <select
          value={String(condition?.value ?? '')}
          onChange={(e) => condition && onChange({ ...condition, value: e.target.value })}
          className="border border-border rounded-md px-2 py-1 text-xs bg-card text-text-secondary min-w-[120px]"
        >
          <option value="">Select...</option>
          {(sourceQuestion.options.choices || []).map((c, ci) => (
            <option key={ci} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            sourceQuestion?.question_type === 'rating' || sourceQuestion?.question_type === 'nps'
              ? 'number'
              : 'text'
          }
          value={condition?.value ?? ''}
          onChange={(e) =>
            condition &&
            onChange({
              ...condition,
              value:
                sourceQuestion?.question_type === 'rating' ||
                sourceQuestion?.question_type === 'nps'
                  ? Number(e.target.value)
                  : e.target.value,
            })
          }
          placeholder="Value"
          className="border border-border rounded-md px-2 py-1 text-xs bg-card text-text-secondary w-24"
        />
      )}

      <button
        onClick={onRemove}
        className="text-xs text-text-muted hover:text-nia-red"
        title="Remove condition"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Type-Specific Options Panel ─────────────────────────────── */

function TypeOptionsPanel({
  question,
  onChange,
}: {
  question: QuestionInput;
  onChange: (updates: Partial<QuestionInput>) => void;
}) {
  const { question_type, options, rating_scale_max } = question;
  const hasCustomLabels = options.labels && options.labels.length > 0;

  switch (question_type) {
    case 'rating':
      return (
        <div className="space-y-3">
          {/* Scale size */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Scale Size
            </label>
            <div className="flex gap-2">
              {RATING_SCALE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() =>
                    onChange({
                      rating_scale_max: size,
                      options: {
                        ...options,
                        labels: options.labels ? DEFAULT_RATING_LABELS[size] || [] : undefined,
                      },
                    })
                  }
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    rating_scale_max === size
                      ? 'border-nia-dark bg-nia-dark/10 text-nia-dark font-medium'
                      : 'border-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  1-{size}
                </button>
              ))}
            </div>
          </div>

          {/* Custom labels toggle */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={!!hasCustomLabels}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({
                      options: {
                        ...options,
                        labels: DEFAULT_RATING_LABELS[rating_scale_max] || [],
                      },
                    });
                  } else {
                    const { labels: _labels, ...rest } = options;
                    onChange({ options: rest });
                  }
                }}
                className="rounded border-border text-nia-green focus:ring-nia-green"
              />
              Custom scale labels
            </label>
          </div>

          {/* Label inputs */}
          {hasCustomLabels && options.labels && (
            <div className="grid grid-cols-2 gap-1.5">
              {options.labels.map((label, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted w-4 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => {
                      const newLabels = [...(options.labels || [])];
                      newLabels[i] = e.target.value;
                      onChange({ options: { ...options, labels: newLabels } });
                    }}
                    placeholder={`Label ${i + 1}`}
                    className="flex-1 border border-border rounded-md px-2 py-1 text-xs bg-card text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-nia-grey-blue/40"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'yes_no':
      return null;

    case 'nps':
      return (
        <p className="text-xs text-text-muted">
          Fixed 0-10 scale. Responses are automatically categorized as Promoters (9-10), Passives
          (7-8), or Detractors (0-6).
        </p>
      );

    case 'multiple_choice':
    case 'checkbox':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              {question_type === 'multiple_choice' ? 'Choices' : 'Options'}
            </label>
            <EditableList
              items={options.choices || ['', '']}
              onChange={(choices) => onChange({ options: { ...options, choices } })}
              placeholder="Option"
              minItems={2}
              addLabel="Add option"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={options.allow_other ?? false}
              onChange={(e) =>
                onChange({
                  options: { ...options, allow_other: e.target.checked },
                })
              }
              className="rounded border-border text-nia-green focus:ring-nia-green"
            />
            Allow &ldquo;Other&rdquo; write-in option
          </label>
        </div>
      );

    case 'open_text':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Text Field Size
            </label>
            <div className="flex gap-2">
              {(['short', 'long'] as const).map((variant) => (
                <button
                  key={variant}
                  onClick={() => onChange({ options: { ...options, variant } })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
                    (options.variant || 'short') === variant
                      ? 'border-nia-dark bg-nia-dark/10 text-nia-dark font-medium'
                      : 'border-border text-text-secondary hover:border-text-muted'
                  }`}
                >
                  {variant}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Max Character Limit <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              type="number"
              value={options.max_length ?? ''}
              onChange={(e) =>
                onChange({
                  options: {
                    ...options,
                    max_length: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
              placeholder="No limit"
              min={1}
              className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-card text-text-secondary w-32 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue"
            />
          </div>
        </div>
      );

    case 'matrix':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Row Labels
            </label>
            <EditableList
              items={options.rows || ['', '']}
              onChange={(rows) => onChange({ options: { ...options, rows } })}
              placeholder="Row"
              minItems={2}
              addLabel="Add row"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Column Labels
            </label>
            <EditableList
              items={options.columns || ['', '']}
              onChange={(columns) => onChange({ options: { ...options, columns } })}
              placeholder="Column"
              minItems={2}
              addLabel="Add column"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

/* ─── Single Question Card ───────────────────────────────────── */

function QuestionCard({
  question,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onMove,
  onDelete,
  onAddSectionBreak,
  allQuestions,
  metrics,
}: {
  question: QuestionInput;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updates: Partial<QuestionInput>) => void;
  onMove: (direction: 'up' | 'down') => void;
  onDelete: () => void;
  onAddSectionBreak: () => void;
  allQuestions: QuestionInput[];
  metrics: MetricOption[];
}) {
  const typeInfo = QUESTION_TYPES.find((t) => t.value === question.question_type);
  const badgeColor = TYPE_BADGE_COLORS[question.question_type];

  return (
    <div>
      {/* Section break */}
      {question.section_label !== undefined && question.section_label !== '' && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex-1 border-t border-border" />
          <input
            type="text"
            value={question.section_label}
            onChange={(e) => onChange({ section_label: e.target.value })}
            placeholder="Section title..."
            className="text-sm font-semibold text-nia-dark bg-transparent border-none focus:outline-none text-center min-w-[120px]"
          />
          <button
            onClick={() => onChange({ section_label: '' })}
            className="text-text-muted hover:text-nia-red"
            title="Remove section break"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1 border-t border-border" />
        </div>
      )}

      {/* Question card */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Collapsed header — always visible */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-subtle/50 transition-colors"
        >
          <span className="text-xs text-text-muted font-mono w-6 flex-shrink-0">{index + 1}</span>
          <GripIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="flex-1 text-sm text-foreground truncate">
            {question.question_text || (
              <span className="text-text-muted italic">Untitled question</span>
            )}
          </span>
          <Badge color={badgeColor} size="xs">
            {typeInfo?.icon} {typeInfo?.label}
          </Badge>
          {!question.is_required && (
            <Badge color="gray" size="xs">
              Optional
            </Badge>
          )}
          {expanded ? (
            <ChevronUpIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
          )}
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border-light space-y-4">
            {/* Question text */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Question Text
              </label>
              <Input
                value={question.question_text}
                onChange={(e) => onChange({ question_text: e.target.value })}
                placeholder="Enter your question..."
                size="sm"
              />
            </div>

            {/* Question type selector */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Question Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      const newOptions: QuestionOptions = {};
                      // Set defaults based on new type
                      if (type.value === 'multiple_choice' || type.value === 'checkbox') {
                        newOptions.choices = question.options.choices?.length
                          ? question.options.choices
                          : ['', ''];
                      }
                      if (type.value === 'open_text') {
                        newOptions.variant = 'short';
                      }
                      if (type.value === 'matrix') {
                        newOptions.rows = question.options.rows?.length
                          ? question.options.rows
                          : ['', ''];
                        newOptions.columns = question.options.columns?.length
                          ? question.options.columns
                          : ['', ''];
                      }
                      // Preserve condition if it existed
                      if (question.options.condition) {
                        newOptions.condition = question.options.condition;
                      }
                      onChange({
                        question_type: type.value,
                        options: newOptions,
                        rating_scale_max:
                          type.value === 'rating'
                            ? question.rating_scale_max
                            : type.value === 'nps'
                              ? 10
                              : 5,
                      });
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                      question.question_type === type.value
                        ? 'border-nia-dark bg-nia-dark/10 text-nia-dark font-medium'
                        : 'border-border text-text-secondary hover:border-text-muted'
                    }`}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific options */}
            <TypeOptionsPanel question={question} onChange={(updates) => onChange(updates)} />

            {/* Help text */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Help Text <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={question.help_text}
                onChange={(e) => onChange({ help_text: e.target.value })}
                placeholder="Add a description or instruction..."
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-foreground bg-card placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue"
              />
            </div>

            {/* Settings row */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Required toggle */}
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={question.is_required}
                  onChange={(e) => onChange({ is_required: e.target.checked })}
                  className="rounded border-border text-nia-green focus:ring-nia-green"
                />
                Required
              </label>

              {/* Metric link (hidden for open_text) */}
              {question.question_type !== 'open_text' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Link to metric:</span>
                  <select
                    value={question.metric_id || ''}
                    onChange={(e) =>
                      onChange({
                        metric_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="text-xs border border-border rounded-md px-2 py-1 text-text-secondary bg-card max-w-[200px]"
                  >
                    <option value="">No metric link</option>
                    {metrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Condition builder */}
            <div>
              {question.options.condition ? (
                <ConditionBuilder
                  condition={question.options.condition}
                  onChange={(condition) =>
                    onChange({ options: { ...question.options, condition } })
                  }
                  onRemove={() => {
                    const { condition: _c, ...rest } = question.options;
                    onChange({ options: rest });
                  }}
                  questions={allQuestions}
                  currentIndex={index}
                />
              ) : (
                index > 0 && (
                  <button
                    onClick={() =>
                      onChange({
                        options: {
                          ...question.options,
                          condition: {
                            question_index: 0,
                            operator: 'equals',
                            value: '',
                          },
                        },
                      })
                    }
                    className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium"
                  >
                    + Add display condition
                  </button>
                )
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-border-light">
              <button
                onClick={() => onMove('up')}
                disabled={index === 0}
                className="p-1.5 text-text-muted hover:text-text-secondary disabled:opacity-30 rounded hover:bg-surface-subtle"
                title="Move up"
              >
                <ChevronUpIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMove('down')}
                disabled={index === total - 1}
                className="p-1.5 text-text-muted hover:text-text-secondary disabled:opacity-30 rounded hover:bg-surface-subtle"
                title="Move down"
              >
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              <div className="flex-1" />
              <button
                onClick={onAddSectionBreak}
                className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium px-2 py-1"
              >
                + Section Break Above
              </button>
              {total > 1 && (
                <button
                  onClick={onDelete}
                  className="p-1.5 text-text-muted hover:text-nia-red rounded hover:bg-nia-red/10"
                  title="Delete question"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Collapsible Section Wrapper ────────────────────────────── */

function CollapsibleField({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-nia-dark transition-colors w-full text-left"
      >
        {open ? (
          <ChevronUpIcon className="w-3.5 h-3.5" />
        ) : (
          <ChevronDownIcon className="w-3.5 h-3.5" />
        )}
        {label}
        <span className="text-text-muted font-normal text-xs">(optional)</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

/* ─── Main Builder Component ─────────────────────────────────── */

export default function SurveyBuilderPage({
  processId,
  metrics,
  existingSurvey,
  initialQuestions,
}: SurveyBuilderPageProps) {
  const router = useRouter();
  const isEditMode = !!existingSurvey;

  // Determine initial question set: edit mode > initialQuestions > blank
  const startingQuestions = existingSurvey?.questions?.length
    ? existingSurvey.questions
    : initialQuestions?.length
      ? initialQuestions
      : [createEmptyQuestion(0)];

  // Form state
  const [title, setTitle] = useState(existingSurvey?.title || '');
  const [description, setDescription] = useState(existingSurvey?.description || '');
  const [isAnonymous, setIsAnonymous] = useState(existingSurvey?.is_anonymous ?? true);
  const [welcomeMessage, setWelcomeMessage] = useState(existingSurvey?.welcome_message || '');
  const [thankYouMessage, setThankYouMessage] = useState(existingSurvey?.thank_you_message || '');
  const [responseTarget, setResponseTarget] = useState<string>(
    existingSurvey?.response_target ? String(existingSurvey.response_target) : ''
  );
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(
    existingSurvey?.recurrence_enabled ?? false
  );
  const [recurrenceCadence, setRecurrenceCadence] = useState(
    existingSurvey?.recurrence_cadence || 'monthly'
  );
  const [recurrenceDurationDays, setRecurrenceDurationDays] = useState(
    existingSurvey?.recurrence_duration_days ?? 14
  );
  const [questions, setQuestions] = useState<QuestionInput[]>(startingQuestions);

  // UI state
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    startingQuestions.length === 1 ? 0 : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Custom');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState('');

  /* ── Question CRUD ──────────────────────────────────────── */

  const addQuestion = useCallback(() => {
    const newQ = createEmptyQuestion(questions.length);
    setQuestions((prev) => [...prev, newQ]);
    setExpandedIndex(questions.length);
  }, [questions.length]);

  const updateQuestion = useCallback((index: number, updates: Partial<QuestionInput>) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  }, []);

  const deleteQuestion = useCallback(
    (index: number) => {
      if (questions.length <= 1) return;
      setQuestions((prev) => prev.filter((_, i) => i !== index));
      if (expandedIndex === index) {
        setExpandedIndex(null);
      } else if (expandedIndex !== null && expandedIndex > index) {
        setExpandedIndex(expandedIndex - 1);
      }
    },
    [questions.length, expandedIndex]
  );

  const moveQuestion = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === questions.length - 1)
      )
        return;

      setQuestions((prev) => {
        const updated = [...prev];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
        return updated;
      });

      // Track expanded state
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (expandedIndex === index) {
        setExpandedIndex(swapIndex);
      } else if (expandedIndex === swapIndex) {
        setExpandedIndex(index);
      }
    },
    [questions.length, expandedIndex]
  );

  const addSectionBreak = useCallback((index: number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        section_label: updated[index].section_label || 'New Section',
      };
      return updated;
    });
  }, []);

  /* ── Save as Template ─────────────────────────────────────── */

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setTemplateSuccess('');

    try {
      const res = await fetch('/api/surveys/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: description || null,
          category: templateCategory || 'Custom',
          questions,
          is_shared: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to save template');
      } else {
        setTemplateSuccess(`Saved as "${templateName}"`);
        setShowSaveTemplate(false);
        setTemplateName('');
        setTimeout(() => setTemplateSuccess(''), 4000);
      }
    } catch {
      setError('Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  }

  /* ── Save ───────────────────────────────────────────────── */

  async function handleSave() {
    setError('');

    if (!title.trim()) {
      setError('Survey title is required');
      return;
    }

    const validQuestions = questions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      setError('At least one question with text is required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...(isEditMode ? { id: existingSurvey!.id } : { process_id: processId }),
        title: title.trim(),
        description: description.trim() || null,
        is_public: true,
        is_anonymous: isAnonymous,
        welcome_message: welcomeMessage.trim() || null,
        thank_you_message: thankYouMessage.trim() || null,
        response_target: responseTarget ? Number(responseTarget) : null,
        recurrence_enabled: recurrenceEnabled,
        recurrence_cadence: recurrenceEnabled ? recurrenceCadence : null,
        recurrence_duration_days: recurrenceEnabled ? recurrenceDurationDays : 14,
        questions: validQuestions.map((q, i) => ({
          ...q,
          sort_order: i,
          question_text: q.question_text.trim(),
          help_text: q.help_text?.trim() || '',
          section_label: q.section_label?.trim() || '',
        })),
      };

      const res = await fetch('/api/surveys', {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save survey');
        setSaving(false);
        return;
      }

      // Redirect back to process page
      const targetProcessId = isEditMode ? existingSurvey!.process_id : processId;
      router.push(`/processes/${targetProcessId}`);
    } catch {
      setError('An unexpected error occurred');
      setSaving(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={
              isEditMode ? `/processes/${existingSurvey!.process_id}` : `/processes/${processId}`
            }
            className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-subtle transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold text-nia-dark flex-1">
            {isEditMode ? 'Edit Survey' : 'Create Survey'}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(`/processes/${isEditMode ? existingSurvey!.process_id : processId}`)
              }
            >
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              {isEditMode ? 'Save Changes' : 'Create Survey'}
            </Button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="text-sm text-nia-red bg-nia-red/10 border border-nia-red/20 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* ─── Header Area ──────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">
              Survey Title <span className="text-nia-red">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q1 Process Satisfaction"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">
              Description <span className="text-text-muted font-normal text-xs">(optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context for respondents"
              rows={2}
            />
          </div>

          {/* Welcome Message (collapsible) */}
          <CollapsibleField label="Welcome Message" defaultOpen={!!welcomeMessage}>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Shown to respondents when they open the survey..."
              rows={3}
            />
          </CollapsibleField>

          {/* Settings row */}
          <div className="flex items-center gap-4 pt-2 border-t border-border-light">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-border text-nia-green focus:ring-nia-green"
              />
              Anonymous responses
            </label>
          </div>
        </div>

        {/* ─── Questions Area ───────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-nia-dark uppercase tracking-wide">
              Questions
            </h2>
            <span className="text-xs text-text-muted">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionCard
                key={i}
                question={q}
                index={i}
                total={questions.length}
                expanded={expandedIndex === i}
                onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
                onChange={(updates) => updateQuestion(i, updates)}
                onMove={(direction) => moveQuestion(i, direction)}
                onDelete={() => deleteQuestion(i)}
                onAddSectionBreak={() => addSectionBreak(i)}
                allQuestions={questions}
                metrics={metrics}
              />
            ))}
          </div>

          <button
            onClick={addQuestion}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-nia-grey-blue hover:text-nia-dark hover:border-nia-grey-blue transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {/* ─── Footer Area ──────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
          {/* Thank-you Message (collapsible) */}
          <CollapsibleField label="Thank-You Message" defaultOpen={!!thankYouMessage}>
            <Textarea
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder="Shown after the respondent submits their answers..."
              rows={3}
            />
          </CollapsibleField>
        </div>

        {/* ─── Distribution Settings ──────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
          <h3 className="text-sm font-semibold text-nia-dark uppercase tracking-wide">
            Distribution Settings
          </h3>

          {/* Response Target */}
          <div>
            <label className="block text-sm font-medium text-nia-dark mb-1">
              Response Target{' '}
              <span className="text-text-muted font-normal text-xs">(optional)</span>
            </label>
            <p className="text-xs text-text-muted mb-2">
              Set a goal for how many responses you want per round. A progress bar will show on the
              survey card.
            </p>
            <input
              type="number"
              value={responseTarget}
              onChange={(e) => setResponseTarget(e.target.value)}
              placeholder="e.g., 25"
              min={1}
              className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground bg-card w-32 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40 focus:border-nia-grey-blue"
            />
          </div>

          {/* Recurring Survey */}
          <div className="pt-3 border-t border-border-light">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  recurrenceEnabled ? 'bg-nia-green' : 'bg-text-muted/30'
                }`}
                onClick={() => setRecurrenceEnabled(!recurrenceEnabled)}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow-sm transition-transform ${
                    recurrenceEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-nia-dark">Recurring Survey</div>
                <div className="text-xs text-text-muted">
                  Automatically deploy new rounds on a schedule
                </div>
              </div>
            </label>

            {recurrenceEnabled && (
              <div className="mt-3 ml-13 flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Cadence
                  </label>
                  <select
                    value={recurrenceCadence}
                    onChange={(e) => setRecurrenceCadence(e.target.value)}
                    className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-card text-text-secondary focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Wave Duration
                  </label>
                  <select
                    value={recurrenceDurationDays}
                    onChange={(e) => setRecurrenceDurationDays(Number(e.target.value))}
                    className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-card text-text-secondary focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/40"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Save as Template ─────────────────────────────── */}
        {questions.length > 0 && questions[0].question_text && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            {templateSuccess && (
              <div className="text-sm text-nia-green bg-nia-green/10 border border-nia-green/20 px-4 py-2 rounded-lg mb-3">
                {templateSuccess}
              </div>
            )}
            {showSaveTemplate ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-nia-dark">Save as Template</h3>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  autoFocus
                />
                <Input
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  placeholder="Category (e.g., Process Effectiveness)"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    loading={savingTemplate}
                    onClick={handleSaveAsTemplate}
                    disabled={!templateName.trim()}
                  >
                    Save Template
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveTemplate(true)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-nia-dark transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  />
                </svg>
                Save these questions as a reusable template
              </button>
            )}
          </div>
        )}

        {/* ─── Bottom action buttons ────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            variant="ghost"
            size="md"
            onClick={() =>
              router.push(`/processes/${isEditMode ? existingSurvey!.process_id : processId}`)
            }
          >
            Cancel
          </Button>
          <Button size="md" loading={saving} onClick={handleSave}>
            {isEditMode ? 'Save Changes' : 'Create Survey'}
          </Button>
        </div>
      </div>
    </div>
  );
}
