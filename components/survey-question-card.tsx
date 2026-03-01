'use client';

import type { SurveyQuestionSuggestion } from '@/lib/ai-parsers';

export default function SurveyQuestionCard({
  suggestion,
  onAdd,
  onDismiss,
  isLoading,
}: {
  suggestion: SurveyQuestionSuggestion;
  onAdd: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden border-l-4"
      style={{
        borderLeftColor: 'var(--nia-grey-blue)',
        backgroundColor: 'rgba(87,129,150,0.04)',
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border-light">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-nia-grey-blue/15 text-nia-grey-blue">
            {suggestion.questionType === 'rating' ? 'Rating 1–5' : 'Yes / No'}
          </span>
        </div>
        <p className="text-sm font-semibold text-nia-dark">{suggestion.questionText}</p>
      </div>

      {/* Rationale */}
      <div className="px-3 py-2">
        <p className="text-xs text-text-secondary italic">{suggestion.rationale}</p>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-border-light flex items-center gap-2">
        <button
          onClick={onAdd}
          disabled={isLoading}
          className="text-xs bg-nia-grey-blue text-white rounded px-3 py-1.5 font-medium hover:bg-nia-grey-blue/80 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Adding...' : 'Add to Survey'}
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-text-muted hover:text-text-secondary font-medium px-2 py-1.5 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
