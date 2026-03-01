'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'error' | 'success';
  onRetry?: () => void;
  onDismiss: () => void;
}

export default function Toast({ message, type, onRetry, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isError = type === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 right-6 z-50 animate-slide-up max-w-sm"
    >
      <div
        className={`bg-card border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 ${
          isError ? 'border-nia-red/30' : 'border-nia-green/30'
        }`}
      >
        {/* Icon */}
        <div className={`flex-shrink-0 ${isError ? 'text-nia-red' : 'text-nia-green'}`}>
          {isError ? (
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>

        {/* Message */}
        <p className="text-sm text-foreground flex-1">{message}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs font-medium text-nia-grey-blue hover:text-nia-dark transition-colors"
            >
              Retry
            </button>
          )}
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-text-muted hover:text-foreground transition-colors"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
