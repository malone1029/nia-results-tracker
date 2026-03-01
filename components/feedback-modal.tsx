'use client';

import { useState } from 'react';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TYPES = [
  {
    value: 'bug',
    label: 'Bug',
    emoji: '🐛',
    color: 'bg-red-500/15 text-red-600 border-red-500/20',
  },
  {
    value: 'idea',
    label: 'Idea',
    emoji: '💡',
    color: 'bg-nia-orange/15 text-nia-orange border-nia-orange/20',
  },
  {
    value: 'question',
    label: 'Question',
    emoji: '❓',
    color: 'bg-nia-grey-blue/15 text-nia-grey-blue border-nia-grey-blue/20',
  },
] as const;

export default function FeedbackModal({ open, onClose, onSuccess }: FeedbackModalProps) {
  const [type, setType] = useState<string>('idea');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const pageUrl = typeof window !== 'undefined' ? window.location.pathname : '';

  async function handleSubmit() {
    if (!description.trim() || description.trim().length < 10) {
      setError('Please write at least 10 characters.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description: description.trim(), page_url: pageUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        setType('idea');
        onClose();
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
          <h2 className="font-semibold text-foreground">Send Feedback</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-foreground font-medium">Thanks for your feedback!</p>
              <p className="text-text-secondary text-sm mt-1">We&apos;ll review it soon.</p>
            </div>
          ) : (
            <>
              {/* Type picker */}
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">Type</label>
                <div className="flex gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        type === t.value
                          ? t.color
                          : 'bg-surface-muted text-text-muted border-border-light hover:border-border'
                      }`}
                    >
                      <span>{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-text-secondary mb-2 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'What went wrong? What were you trying to do?'
                      : type === 'idea'
                        ? 'What would make the Hub better?'
                        : 'What are you trying to figure out?'
                  }
                  rows={4}
                  className="w-full rounded-lg border border-border-light bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-nia-grey-blue/30 resize-none"
                />
              </div>

              {/* Page URL */}
              <p className="text-xs text-text-muted">
                Submitted from: <span className="font-mono">{pageUrl || '/'}</span>
              </p>

              {/* Error */}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-5 py-3 border-t border-border-light flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="px-4 py-2 bg-nia-dark-solid text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
