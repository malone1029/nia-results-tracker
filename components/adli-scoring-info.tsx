'use client';

import { useState, useEffect } from 'react';
import { ADLI_COLORS } from '@/lib/colors';

/**
 * Info modal explaining how AI scores ADLI dimensions.
 * Triggered by a small ⓘ icon button.
 */
export default function AdliScoringInfo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      {/* Info dot trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-text-muted hover:text-nia-dark hover:bg-surface-hover transition-colors"
        title="How are these scores calculated?"
        aria-label="How are ADLI scores calculated?"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How ADLI Scoring Works"
        >
          <div
            className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border-light px-5 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-lg font-semibold text-nia-dark">How ADLI Scores Work</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-nia-dark transition-colors p-1"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-5 text-sm text-text-secondary leading-relaxed">
              <p>
                When you run an ADLI assessment, the AI coach reviews your process documentation and
                scores each of the four dimensions from 0 to 100.
              </p>

              {/* What it evaluates */}
              <div>
                <h4 className="text-sm font-semibold text-nia-dark mb-2">
                  What each dimension measures
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: ADLI_COLORS.approach }}
                    >
                      A
                    </span>
                    <div>
                      <span className="font-medium text-nia-dark">Approach</span>
                      <p className="text-text-tertiary mt-0.5">
                        Is there a documented, repeatable method? Does it have a clear rationale and
                        evidence behind it?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: ADLI_COLORS.deployment }}
                    >
                      D
                    </span>
                    <div>
                      <span className="font-medium text-nia-dark">Deployment</span>
                      <p className="text-text-tertiary mt-0.5">
                        Is the approach applied consistently? Are the scope, roles, and training
                        defined?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: ADLI_COLORS.learning }}
                    >
                      L
                    </span>
                    <div>
                      <span className="font-medium text-nia-dark">Learning</span>
                      <p className="text-text-tertiary mt-0.5">
                        Is the process measured and improved over time? Are there metrics, review
                        cycles, and documented changes?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: ADLI_COLORS.integration }}
                    >
                      I
                    </span>
                    <div>
                      <span className="font-medium text-nia-dark">Integration</span>
                      <p className="text-text-tertiary mt-0.5">
                        Does the process connect to NIA&apos;s strategic goals? Does it link to
                        related processes and shared measures?
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* What the AI looks at */}
              <div>
                <h4 className="text-sm font-semibold text-nia-dark mb-2">What the AI reviews</h4>
                <p className="mb-2">The AI reads all of the following when producing scores:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Charter &amp; ADLI sections</strong> &mdash;
                      the core documentation you&apos;ve written for this process
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Linked metrics</strong> &mdash; values,
                      targets, trends, and whether metrics are current or overdue
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Survey results</strong> &mdash; stakeholder
                      feedback scores from any process surveys
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Improvement history</strong> &mdash; recent
                      changes so the AI knows what&apos;s already been addressed
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Asana project data</strong> &mdash; task
                      completion, sections, and progress from your linked project
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Uploaded files</strong> &mdash; any
                      documents or images you&apos;ve attached to this process
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nia-orange mt-0.5">&#9679;</span>
                    <span>
                      <strong className="text-nia-dark">Key requirements</strong> &mdash;
                      stakeholder needs linked to this process
                    </span>
                  </li>
                </ul>
              </div>

              {/* Maturity levels */}
              <div>
                <h4 className="text-sm font-semibold text-nia-dark mb-2">Maturity levels</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface-subtle rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-nia-red">0 &ndash; 25%</span>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Reacting &mdash; no systematic approach yet
                    </p>
                  </div>
                  <div className="bg-surface-subtle rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-nia-orange">30 &ndash; 45%</span>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Early Systematic &mdash; starting to document
                    </p>
                  </div>
                  <div className="bg-surface-subtle rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-nia-green">50 &ndash; 65%</span>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Aligned &mdash; consistent and documented
                    </p>
                  </div>
                  <div className="bg-surface-subtle rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-nia-dark">70 &ndash; 100%</span>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Integrated &mdash; measured and strategic
                    </p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-nia-orange/5 border border-nia-orange/15 rounded-lg px-4 py-3">
                <h4 className="text-sm font-semibold text-nia-dark mb-1">
                  Tips to improve your scores
                </h4>
                <ul className="space-y-1 text-xs text-text-tertiary">
                  <li>
                    &bull; <strong className="text-text-secondary">Learning scores low?</strong>{' '}
                    Link metrics and create a survey &mdash; the AI needs evidence of measurement.
                  </li>
                  <li>
                    &bull; <strong className="text-text-secondary">Integration scores low?</strong>{' '}
                    Link key requirements and Baldrige connections to show strategic alignment.
                  </li>
                  <li>
                    &bull; <strong className="text-text-secondary">Scores not changing?</strong> The
                    AI only sees what&apos;s written &mdash; update your ADLI sections to reflect
                    actual practice.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
