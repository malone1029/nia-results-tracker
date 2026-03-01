'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import HealthRing from '@/components/health-ring';
import HelpTip from '@/components/help-tip';
import type { HealthResult } from '@/lib/process-health';

const DIMENSION_LABELS: Record<string, string> = {
  documentation: 'Documentation',
  maturity: 'Maturity',
  measurement: 'Measurement',
  operations: 'Operations',
  freshness: 'Freshness',
};

export default function ProcessHealthCard({ health }: { health: HealthResult }) {
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  const dims = Object.entries(health.dimensions) as [
    string,
    typeof health.dimensions.documentation,
  ][];

  return (
    <Card padding="lg">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Left: ring + level */}
        <div className="flex sm:flex-col items-center gap-3 sm:gap-1">
          <HealthRing
            score={health.total}
            color={health.level.color}
            size={72}
            strokeWidth={5}
            className="text-lg"
          />
          <div className="sm:text-center">
            <div className="text-sm font-semibold" style={{ color: health.level.color }}>
              {health.level.label}
            </div>
            <div className="text-xs text-text-muted sm:hidden">
              Process Health
              <HelpTip text="Scored across 5 dimensions: Documentation, Maturity, Measurement, Operations, Freshness. 80+ = Baldrige Ready." />
            </div>
          </div>
        </div>

        {/* Right: dimension bars */}
        <div className="flex-1 space-y-2">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Process Health
            <HelpTip text="Scored across 5 dimensions: Documentation, Maturity, Measurement, Operations, Freshness. 80+ = Baldrige Ready." />
          </div>
          {dims.map(([key, dim]) => {
            const pct = Math.round((dim.score / dim.max) * 100);
            const isExpanded = expandedDim === key;
            return (
              <div key={key}>
                <button
                  onClick={() => setExpandedDim(isExpanded ? null : key)}
                  className="w-full flex items-center gap-3 group"
                >
                  <span className="text-xs text-text-secondary w-28 text-left">
                    {DIMENSION_LABELS[key]}
                  </span>
                  <div className="flex-1 bg-surface-subtle rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: health.level.color,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-12 text-right">
                    {dim.score}/{dim.max}
                  </span>
                  <svg
                    className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="ml-31 mt-1 mb-2 space-y-1 pl-28">
                    {dim.details.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={d.earned > 0 ? 'text-nia-green' : 'text-text-muted'}>
                          {d.earned > 0 ? '\u2713' : '\u2717'}
                        </span>
                        <span className={d.earned > 0 ? 'text-text-secondary' : 'text-text-muted'}>
                          {d.label}
                        </span>
                        <span className="text-text-muted ml-auto">
                          {d.earned}/{d.possible}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next actions */}
      {health.nextActions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border-light">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Next Actions
          </div>
          <div className="space-y-1.5">
            {health.nextActions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-nia-orange">&#x25B8;</span>
                {action.href ? (
                  <Link
                    href={action.href}
                    className="text-nia-grey-blue hover:text-nia-dark transition-colors"
                  >
                    {action.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary">{action.label}</span>
                )}
                <span className="text-xs text-text-muted ml-auto">+{action.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
