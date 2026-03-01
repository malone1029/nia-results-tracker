'use client';

import { useState, useEffect } from 'react';

interface SectionIntroProps {
  storageKey: string;
  children: React.ReactNode;
}

export default function SectionIntro({ storageKey, children }: SectionIntroProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`section-intro-${storageKey}`);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  function dismiss() {
    localStorage.setItem(`section-intro-${storageKey}`, 'dismissed');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-nia-grey-blue/10 border border-nia-grey-blue/20">
      {/* Info icon */}
      <svg
        className="w-5 h-5 text-nia-grey-blue flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="flex-1 text-sm text-nia-dark">{children}</div>
      <button
        onClick={dismiss}
        className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
        aria-label="Dismiss"
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
