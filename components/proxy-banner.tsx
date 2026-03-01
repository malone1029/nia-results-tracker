'use client';

import { useState } from 'react';
import { useRole } from '@/lib/use-role';

export default function ProxyBanner() {
  const { isProxying, proxyTargetName } = useRole();
  const [exiting, setExiting] = useState(false);

  if (!isProxying) return null;

  async function handleExit() {
    setExiting(true);
    await fetch('/api/admin/proxy', { method: 'DELETE' });
    window.location.href = '/settings';
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium shrink-0">
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Viewing as <strong className="ml-1">{proxyTargetName}</strong>
        <span className="opacity-75 font-normal">— read-only view</span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="text-white/90 hover:text-white underline underline-offset-2 transition-opacity disabled:opacity-50 text-xs"
      >
        {exiting ? 'Exiting...' : 'Exit view'}
      </button>
    </div>
  );
}
