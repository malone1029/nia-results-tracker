import Link from 'next/link';
import { Card, Badge } from '@/components/ui';
import EmptyState from '@/components/empty-state';
import type { ActionItem } from './types';

const ACTION_BADGE: Record<string, { color: 'red' | 'orange'; label: string }> = {
  overdue: { color: 'red', label: 'overdue' },
  'due-soon': { color: 'orange', label: 'due soon' },
};

/* ─── Metric Action Items ──────────────────────────────────── */

export function MetricActionItems({ items }: { items: ActionItem[] }) {
  return (
    <Card padding="md">
      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
        Action Items
      </h2>
      {items.length === 0 ? (
        <EmptyState
          illustration="check"
          title="All caught up!"
          description="No overdue metrics or draft processes."
          compact
        />
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map((item, i) => {
            const badgeInfo = ACTION_BADGE[item.type];
            return (
              <Link
                key={`${item.type}-${i}`}
                href={item.href}
                className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-surface-hover transition-colors group"
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'overdue' ? 'overdue-pulse' : ''}`}
                  style={{
                    backgroundColor:
                      item.type === 'overdue'
                        ? '#dc2626'
                        : item.type === 'due-soon'
                          ? '#f79935'
                          : 'var(--text-muted)',
                  }}
                />
                <span className="text-sm text-nia-dark group-hover:text-nia-orange transition-colors truncate">
                  {item.label}
                </span>
                <Badge color={badgeInfo.color} size="xs" className="ml-auto flex-shrink-0">
                  {badgeInfo.label}
                </Badge>
                {item.metricId && (
                  <Link
                    href={`/log?metricId=${item.metricId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-1.5 text-xs font-medium text-nia-grey-blue hover:text-nia-dark bg-surface-subtle hover:bg-surface-muted rounded px-2 py-0.5 transition-colors flex-shrink-0"
                  >
                    Log
                  </Link>
                )}
              </Link>
            );
          })}
          {items.length > 8 && (
            <p className="text-xs text-text-muted px-2 pt-1">+{items.length - 8} more</p>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─── Next Actions (from health scores) ────────────────────── */

export function NextActions({
  actions,
  isAllOwners,
}: {
  actions: { label: string; points: number; count: number; href?: string }[];
  isAllOwners: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <Card padding="md">
      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
        {isAllOwners ? 'Top Actions for Readiness' : 'My Next Actions'}
      </h2>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-2.5 py-1.5 px-2">
            <span className="text-nia-orange font-bold text-sm mt-px">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              {action.href ? (
                <Link
                  href={action.href}
                  className="text-sm text-nia-dark hover:text-nia-orange transition-colors"
                >
                  {action.label}
                </Link>
              ) : (
                <span className="text-sm text-nia-dark">{action.label}</span>
              )}
              <div className="text-xs text-text-muted mt-0.5">
                +{action.points} pts{action.count > 1 ? ` across ${action.count} processes` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
