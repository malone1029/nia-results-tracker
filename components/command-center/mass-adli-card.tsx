'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, Button } from '@/components/ui';

type ScopeOption = 'all' | 'key' | 'unscored';

interface ProgressState {
  current: number;
  total: number;
  processName: string;
}

interface ScoredResult {
  processId: number;
  processName: string;
  overall: number;
}

interface SummaryState {
  total: number;
  scored: number;
  failed: number;
  failedProcesses: { processId: number; processName: string; error: string }[];
  avgByCategory: { category: string; avg: number }[];
}

type Status = 'idle' | 'running' | 'complete' | 'error';

const SCOPE_LABELS: Record<ScopeOption, string> = {
  all: 'All Processes',
  key: 'Key Processes Only',
  unscored: 'Unscored Only',
};

export default function MassAdliCard() {
  const [scope, setScope] = useState<ScopeOption>('unscored');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [recentScored, setRecentScored] = useState<ScoredResult[]>([]);
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function runScan() {
    setStatus('running');
    setProgress(null);
    setRecentScored([]);
    setSummary(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/mass-adli-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setErrorMsg(err.error || 'Scan failed');
        setStatus('error');
        return;
      }

      if (!res.body) {
        setErrorMsg('No response body');
        setStatus('error');
        return;
      }

      // Read NDJSON stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            if (event.type === 'progress') {
              setProgress({
                current: event.current,
                total: event.total,
                processName: event.processName,
              });
            } else if (event.type === 'scored') {
              setRecentScored((prev) => [
                {
                  processId: event.processId,
                  processName: event.processName,
                  overall: event.overall,
                },
                ...prev.slice(0, 9), // keep last 10
              ]);
            } else if (event.type === 'complete') {
              setSummary(event.summary);
              setStatus('complete');
            } else if (event.type === 'error') {
              // Individual process error — keep running
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      if (status !== 'complete') setStatus('complete');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card padding="md">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-nia-dark/10 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-nia-dark"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-nia-dark">Mass ADLI Scan</h2>
          <p className="text-sm text-text-tertiary mt-0.5">
            Score processes using AI. Results flow to Dashboard and ADLI Insights.
          </p>
        </div>
      </div>

      {/* Scope selector */}
      <div className="mb-4">
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
          Scope
        </p>
        <div className="flex flex-wrap gap-2">
          {(['all', 'key', 'unscored'] as ScopeOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              disabled={status === 'running'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                scope === s
                  ? 'bg-nia-dark text-white'
                  : 'bg-surface-hover text-text-secondary hover:text-nia-dark'
              } disabled:opacity-50`}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Run button */}
      <Button
        onClick={runScan}
        disabled={status === 'running'}
        loading={status === 'running'}
        size="sm"
      >
        {status === 'running' ? 'Scanning...' : status === 'complete' ? 'Scan Again' : 'Run Scan'}
      </Button>

      {/* Error */}
      {errorMsg && (
        <div className="mt-4 rounded-lg p-3 text-sm bg-nia-red/10 border border-nia-red/30 text-nia-red">
          {errorMsg}
        </div>
      )}

      {/* Live progress */}
      {status === 'running' && progress && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              Scoring {progress.current} of {progress.total}:{' '}
              <span className="font-medium text-nia-dark">{progress.processName}</span>
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-nia-dark rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Live scored feed */}
          {recentScored.length > 0 && (
            <div className="mt-3 space-y-1">
              {recentScored.slice(0, 5).map((r) => (
                <div
                  key={r.processId}
                  className="flex items-center justify-between py-1 px-2 rounded bg-card text-xs"
                >
                  <span className="text-nia-dark truncate mr-2">{r.processName}</span>
                  <span
                    className={`font-medium whitespace-nowrap ${
                      r.overall >= 70
                        ? 'text-nia-dark'
                        : r.overall >= 50
                          ? 'text-nia-green'
                          : r.overall >= 30
                            ? 'text-nia-orange'
                            : 'text-nia-red'
                    }`}
                  >
                    {r.overall}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {status === 'complete' && summary && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-nia-dark font-medium">
              <svg
                className="w-4 h-4 text-nia-green"
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
              {summary.scored} scored
            </span>
            {summary.failed > 0 && (
              <span className="flex items-center gap-1.5 text-nia-red font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {summary.failed} failed
              </span>
            )}
          </div>

          {/* Failed process list */}
          {summary.failedProcesses.length > 0 && (
            <div className="rounded-lg bg-nia-red/5 border border-nia-red/20 p-3 space-y-1">
              {summary.failedProcesses.map((f) => (
                <div key={f.processId} className="text-xs text-nia-red">
                  <span className="font-medium">{f.processName}:</span> {f.error}
                </div>
              ))}
            </div>
          )}

          {/* Average by category */}
          {summary.avgByCategory.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-hover border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary">
                      Category
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-text-secondary">
                      Avg Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.avgByCategory
                    .sort((a, b) => b.avg - a.avg)
                    .map((row) => (
                      <tr key={row.category} className="border-b border-border-light last:border-0">
                        <td className="py-2 px-3 text-nia-dark">{row.category}</td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={`font-medium ${
                              row.avg >= 70
                                ? 'text-nia-dark'
                                : row.avg >= 50
                                  ? 'text-nia-green'
                                  : row.avg >= 30
                                    ? 'text-nia-orange'
                                    : 'text-nia-red'
                            }`}
                          >
                            {row.avg}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <Link
            href="/adli-insights"
            className="inline-flex items-center gap-1.5 text-sm text-nia-dark font-medium hover:text-nia-grey-blue transition-colors"
          >
            View ADLI Insights
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </Card>
  );
}
