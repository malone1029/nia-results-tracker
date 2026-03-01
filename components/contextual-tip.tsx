'use client';

import { useState, useEffect } from 'react';

interface ContextualTipProps {
  tipId: string;
  show: boolean;
  children: React.ReactNode;
}

export default function ContextualTip({ tipId, show, children }: ContextualTipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    const dismissed = localStorage.getItem(`tip-${tipId}`);
    if (!dismissed) setVisible(true);
  }, [tipId, show]);

  function dismiss() {
    localStorage.setItem(`tip-${tipId}`, 'dismissed');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-nia-orange/10 border border-nia-orange/20">
      {/* Lightbulb icon */}
      <svg
        className="w-5 h-5 text-nia-orange flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      <div className="flex-1 text-sm text-nia-dark">{children}</div>
      <button
        onClick={dismiss}
        className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
        aria-label="Dismiss tip"
      >
        <svg
          className="w-4 h-4"
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
