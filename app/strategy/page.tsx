// app/strategy/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/lib/use-role';
import { Card, Badge } from '@/components/ui';
import { NIA_COLORS } from '@/lib/colors';
import type { BscPerspective, StrategicObjectiveWithStatus, ObjectiveStatus } from '@/lib/types';

const PERSPECTIVES: { key: BscPerspective; label: string; description: string }[] = [
  {
    key: 'financial',
    label: 'Financial Stability',
    description: 'Ensure resources to fulfill mission',
  },
  {
    key: 'org_capacity',
    label: 'Organizational Capacity',
    description: 'Invest in people, tools, knowledge',
  },
  {
    key: 'internal_process',
    label: 'Internal Processes',
    description: 'Improve efficiency and service quality',
  },
  {
    key: 'customer',
    label: 'Customer Satisfaction',
    description: 'Retain and delight member districts',
  },
];

function statusColor(s: ObjectiveStatus): string {
  switch (s) {
    case 'green':
      return NIA_COLORS.green;
    case 'yellow':
      return NIA_COLORS.orange;
    case 'red':
      return NIA_COLORS.red;
    default:
      return 'var(--grid-line)';
  }
}

function trendIcon(t: string): string {
  switch (t) {
    case 'improving':
      return '↑';
    case 'declining':
      return '↓';
    case 'flat':
      return '→';
    default:
      return '—';
  }
}

function trendColor(t: string): string {
  switch (t) {
    case 'improving':
      return NIA_COLORS.green;
    case 'declining':
      return NIA_COLORS.red;
    default:
      return 'var(--text-muted)';
  }
}

function ObjectiveRow({ obj }: { obj: StrategicObjectiveWithStatus }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-foreground truncate">{obj.title}</p>
        {obj.target_value !== null && (
          <p className="text-xs text-text-muted mt-0.5">
            Target: {obj.target_value}
            {obj.target_unit ? ` ${obj.target_unit}` : ''}
            {obj.target_year ? ` by FY${String(obj.target_year).slice(2)}` : ''}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {obj.computed_value !== null ? (
          <span className="text-sm font-semibold text-foreground">
            {obj.computed_value}
            {obj.target_value !== null && (
              <span className="text-xs text-text-muted font-normal"> / {obj.target_value}</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-text-muted">No data</span>
        )}
        <span className="text-sm" style={{ color: trendColor(obj.trend_direction) }}>
          {trendIcon(obj.trend_direction)}
        </span>
        {obj.linked_process_count > 0 && (
          <Badge color="gray" size="xs">
            {obj.linked_process_count} process{obj.linked_process_count !== 1 ? 'es' : ''}
          </Badge>
        )}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColor(obj.status) }}
        />
      </div>
    </div>
  );
}

export default function StrategyPage() {
  const { role } = useRole();
  const [objectives, setObjectives] = useState<StrategicObjectiveWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'objectives'>('scorecard');
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    document.title = 'Strategic Plan | NIA Excellence Hub';
    fetch('/api/strategy')
      .then((r) => r.json())
      .then((d) => {
        setObjectives(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const onTrackCount = objectives.filter((o) => o.status === 'green').length;
  const byPerspective = (p: BscPerspective) => objectives.filter((o) => o.bsc_perspective === p);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-64 bg-surface-subtle rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Strategic Plan</h1>
          <p className="text-text-muted mt-1">
            FY2026 Balanced Scorecard — NIA Excellence Framework
          </p>
        </div>
        <div className="text-sm font-medium px-3 py-1.5 rounded-full bg-nia-green/10 text-nia-green border border-nia-green/20">
          {onTrackCount} / {objectives.length} on track
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['scorecard', 'objectives'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-nia-dark-solid text-foreground'
                : 'border-transparent text-text-muted hover:text-foreground'
            }`}
          >
            {tab === 'scorecard' ? 'Scorecard' : 'Objectives'}
          </button>
        ))}
      </div>

      {/* Scorecard tab — 2x2 BSC grid */}
      {activeTab === 'scorecard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PERSPECTIVES.map((p) => {
            const objs = byPerspective(p.key);
            const onTrack = objs.filter((o) => o.status === 'green').length;
            return (
              <Card key={p.key} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{p.label}</h2>
                    <p className="text-xs text-text-muted mt-0.5">{p.description}</p>
                  </div>
                  <span className="text-xs text-text-muted flex-shrink-0 ml-2">
                    {onTrack}/{objs.length}
                  </span>
                </div>
                {objs.length === 0 ? (
                  <p className="text-sm text-text-muted italic">
                    No objectives in this perspective.
                  </p>
                ) : (
                  objs.map((obj) => <ObjectiveRow key={obj.id} obj={obj} />)
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Objectives tab — full list with meta */}
      {activeTab === 'objectives' && (
        <div className="space-y-6">
          {PERSPECTIVES.map((p) => {
            const objs = byPerspective(p.key);
            return (
              <div key={p.key}>
                <h2 className="text-base font-semibold text-foreground mb-3">{p.label}</h2>
                <div className="space-y-2">
                  {objs.map((obj) => (
                    <Card key={obj.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{obj.title}</p>
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: statusColor(obj.status) }}
                            />
                          </div>
                          {obj.description && (
                            <p className="text-xs text-text-muted mt-1">{obj.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-text-muted">
                            {obj.target_value !== null && (
                              <span>
                                Target:{' '}
                                <strong className="text-foreground">
                                  {obj.target_value} {obj.target_unit}
                                </strong>
                              </span>
                            )}
                            {obj.computed_value !== null && (
                              <span>
                                Current:{' '}
                                <strong className="text-foreground">{obj.computed_value}</strong>
                              </span>
                            )}
                            <span>
                              Data:{' '}
                              <strong className="text-foreground capitalize">
                                {obj.compute_type.replace('_', ' ')}
                              </strong>
                            </span>
                            <span>
                              {obj.linked_process_count} process
                              {obj.linked_process_count !== 1 ? 'es' : ''} linked
                            </span>
                          </div>
                        </div>
                        {isSuperAdmin && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                const newValue = window.prompt(
                                  `Update current value for "${obj.title}":`,
                                  obj.current_value !== null ? String(obj.current_value) : ''
                                );
                                if (newValue === null) return;
                                const parsed = newValue === '' ? null : Number(newValue);
                                fetch(`/api/strategy/${obj.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ current_value: parsed }),
                                }).then(() => {
                                  setObjectives((prev) =>
                                    prev.map((o) =>
                                      o.id === obj.id
                                        ? { ...o, current_value: parsed, computed_value: parsed }
                                        : o
                                    )
                                  );
                                });
                              }}
                              className="text-xs text-nia-grey-blue hover:text-nia-dark transition-colors px-2 py-1 rounded border border-border hover:bg-surface-subtle"
                            >
                              Update value
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
