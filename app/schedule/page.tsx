'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getReviewStatus,
  getStatusColor,
  getStatusLabel,
  formatDate,
  formatValue,
} from '@/lib/review-status';
import { ListPageSkeleton } from '@/components/skeleton';
import type { Metric } from '@/lib/types';
import Link from 'next/link';
import { Card, Badge, Button } from '@/components/ui';

interface MetricRow extends Metric {
  process_name: string;
  is_key_process: boolean;
  process_type: string;
  category_display_name: string;
  last_entry_date: string | null;
  last_entry_value: number | null;
  review_status: 'current' | 'due-soon' | 'overdue' | 'no-data' | 'scheduled';
}

const CADENCE_ORDER = ['monthly', 'quarterly', 'semi-annual', 'annual'] as const;
const CADENCE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'semi-annual': 'Semi-Annual',
  annual: 'Annual',
};
const CADENCE_DESCRIPTIONS: Record<string, string> = {
  monthly: 'Review these metrics every 30 days',
  quarterly: 'Review these metrics every 90 days',
  'semi-annual': 'Review these metrics every 6 months',
  annual: 'Review these metrics once per fiscal year',
};

export default function SchedulePage() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'key' | 'support'>('all');

  useEffect(() => {
    document.title = 'Review Schedule | NIA Excellence Hub';
    async function fetch() {
      // Fetch metrics, junction links, and processes separately
      const [metricsRes, linksRes, processesRes, entriesRes] = await Promise.all([
        supabase.from('metrics').select('*'),
        supabase.from('metric_processes').select('metric_id, process_id'),
        supabase
          .from('processes')
          .select('id, name, process_type, categories!inner ( display_name )'),
        supabase
          .from('entries')
          .select('metric_id, value, date')
          .order('date', { ascending: false }),
      ]);

      // Build process lookup
      const processMap = new Map<
        number,
        { name: string; process_type: string; category_display_name: string }
      >();
      for (const p of (processesRes.data || []) as Record<string, unknown>[]) {
        const cat = p.categories as Record<string, unknown>;
        processMap.set(p.id as number, {
          name: p.name as string,
          process_type: (p.process_type as string) || 'unclassified',
          category_display_name: cat.display_name as string,
        });
      }

      // Build metric -> first process lookup
      const metricFirstProcess = new Map<
        number,
        { name: string; process_type: string; category_display_name: string }
      >();
      for (const link of linksRes.data || []) {
        if (metricFirstProcess.has(link.metric_id)) continue;
        const proc = processMap.get(link.process_id);
        if (proc) metricFirstProcess.set(link.metric_id, proc);
      }

      const latestEntries = new Map<number, { value: number; date: string }>();
      if (entriesRes.data) {
        for (const entry of entriesRes.data) {
          if (!latestEntries.has(entry.metric_id)) {
            latestEntries.set(entry.metric_id, { value: entry.value, date: entry.date });
          }
        }
      }

      const rows: MetricRow[] = (metricsRes.data || []).map((m: Record<string, unknown>) => {
        const proc = metricFirstProcess.get(m.id as number);
        const latest = latestEntries.get(m.id as number);
        return {
          ...(m as unknown as Metric),
          process_name: proc?.name || 'Unlinked',
          is_key_process: (proc?.process_type || 'unclassified') === 'key',
          process_type: proc?.process_type || 'unclassified',
          category_display_name: proc?.category_display_name || '—',
          last_entry_date: latest?.date || null,
          last_entry_value: latest?.value || null,
          review_status: getReviewStatus(
            m.cadence as string,
            latest?.date || null,
            m.next_entry_expected as string | null
          ),
        };
      });

      setMetrics(rows);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <ListPageSkeleton showStats statCount={4} />;

  // Filter by process type if active
  const filteredMetrics =
    typeFilter === 'key'
      ? metrics.filter((m) => m.process_type === 'key')
      : typeFilter === 'support'
        ? metrics.filter((m) => m.process_type === 'support')
        : metrics;

  // Group by cadence
  const grouped = new Map<string, MetricRow[]>();
  for (const cadence of CADENCE_ORDER) {
    grouped.set(cadence, []);
  }
  for (const metric of filteredMetrics) {
    const list = grouped.get(metric.cadence);
    if (list) list.push(metric);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">Review Schedule</h1>
          <p className="text-text-tertiary mt-1">
            Metrics organized by how often they need to be reviewed
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface-subtle rounded-lg p-1">
          {(['all', 'key', 'support'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                typeFilter === t
                  ? 'bg-card text-nia-dark shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {t === 'all' ? 'All' : t === 'key' ? '\u2605 Key' : 'Support'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CADENCE_ORDER.map((cadence) => {
          const list = grouped.get(cadence) || [];
          const needsAttention = list.filter(
            (m) => m.review_status === 'overdue' || m.review_status === 'no-data'
          ).length;
          return (
            <a key={cadence} href={`#${cadence}`}>
              <Card
                variant="interactive"
                accent={needsAttention > 0 ? 'orange' : 'dark'}
                padding="sm"
                className="text-center"
              >
                <div className="text-2xl font-bold font-display number-pop text-nia-dark">
                  {list.length}
                </div>
                <div className="text-sm font-medium text-nia-grey-blue">
                  {CADENCE_LABELS[cadence]}
                </div>
                {needsAttention > 0 && (
                  <div className="text-xs text-nia-orange font-medium mt-1">
                    {needsAttention} need attention
                  </div>
                )}
              </Card>
            </a>
          );
        })}
      </div>

      {/* Cadence sections */}
      {CADENCE_ORDER.map((cadence) => {
        const list = grouped.get(cadence) || [];
        if (list.length === 0) return null;

        // Sort: overdue/no-data first, then due-soon, then current
        const statusOrder = { overdue: 0, 'no-data': 1, 'due-soon': 2, current: 3, scheduled: 4 };
        list.sort((a, b) => statusOrder[a.review_status] - statusOrder[b.review_status]);

        const needsAttention = list.filter(
          (m) => m.review_status === 'overdue' || m.review_status === 'due-soon'
        ).length;

        return (
          <CadenceSection
            key={cadence}
            id={cadence}
            label={CADENCE_LABELS[cadence]}
            description={CADENCE_DESCRIPTIONS[cadence]}
            metrics={list}
            needsAttention={needsAttention}
            defaultOpen={false}
          />
        );
      })}
    </div>
  );
}

function CadenceSection({
  id,
  label,
  description,
  metrics,
  needsAttention,
  defaultOpen,
}: {
  id: string;
  label: string;
  description: string;
  metrics: MetricRow[];
  needsAttention: number;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card id={id} accent="orange">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`section-chevron text-text-muted text-sm ${isOpen ? 'open' : ''}`}>
            ▶
          </span>
          <div>
            <span className="text-lg font-bold text-nia-dark">{label}</span>
            <span className="text-sm text-text-muted ml-3">
              {metrics.length} metric{metrics.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {needsAttention > 0 && (
            <Badge color="orange" size="xs">
              {needsAttention} need attention
            </Badge>
          )}
          <span className="text-xs text-text-muted">{description}</span>
        </div>
      </button>

      <div className={`section-body ${isOpen ? 'open' : ''}`}>
        <div>
          <div className="border-t border-border-light">
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="bg-surface-hover text-text-tertiary text-left text-xs uppercase">
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Metric</th>
                  <th className="px-4 py-2">Process</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2 text-right">Last Value</th>
                  <th className="px-4 py-2 text-right">Last Logged</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr
                    key={metric.id}
                    className="border-t border-border-light hover:bg-surface-hover"
                  >
                    <td className="px-4 py-2">
                      <Badge
                        color={
                          metric.review_status === 'current'
                            ? 'green'
                            : metric.review_status === 'overdue'
                              ? 'red'
                              : metric.review_status === 'due-soon'
                                ? 'orange'
                                : 'gray'
                        }
                        size="xs"
                      >
                        {getStatusLabel(metric.review_status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/metric/${metric.id}`}
                        className="text-nia-dark font-medium hover:text-nia-orange transition-colors"
                      >
                        {metric.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-text-tertiary">
                      {metric.process_type === 'key' && (
                        <span className="text-nia-orange mr-1">&#9733;</span>
                      )}
                      {metric.process_name}
                    </td>
                    <td className="px-4 py-2 text-text-muted">{metric.data_source || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatValue(metric.last_entry_value, metric.unit)}
                    </td>
                    <td className="px-4 py-2 text-right text-text-muted">
                      {formatDate(metric.last_entry_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile stacked cards */}
            <div className="md:hidden divide-y divide-border-light">
              {metrics.map((metric) => (
                <div key={metric.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/metric/${metric.id}`}
                      className="text-nia-dark font-medium hover:text-nia-orange transition-colors text-sm"
                    >
                      {metric.name}
                    </Link>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: getStatusColor(metric.review_status) + '20',
                        color: getStatusColor(metric.review_status),
                      }}
                    >
                      {getStatusLabel(metric.review_status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-muted">
                    <span>
                      {metric.is_key_process && (
                        <span className="text-nia-orange mr-0.5">&#9733;</span>
                      )}
                      {metric.process_name}
                    </span>
                    {metric.data_source && <span>{metric.data_source}</span>}
                    <span className="font-medium text-nia-dark">
                      {metric.last_entry_value !== null
                        ? formatValue(metric.last_entry_value, metric.unit)
                        : 'No data'}
                    </span>
                    <span>{formatDate(metric.last_entry_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
