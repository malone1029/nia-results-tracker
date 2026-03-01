import Link from 'next/link';
import { Card } from '@/components/ui';
import HealthRing from '@/components/health-ring';
import HelpTip from '@/components/help-tip';
import type { DashboardTaskStats } from './types';

/* ─── StatCard ─────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  color,
  subtitle,
  glow,
  href,
  helpText,
}: {
  label: string;
  value: number | string;
  color: string;
  subtitle?: string;
  glow?: 'red' | 'orange' | 'green' | 'dark';
  href?: string;
  helpText?: string;
}) {
  const card = (
    <Card
      variant="elevated"
      padding="sm"
      className={`p-4 h-full ${glow ? `glow-${glow}` : ''} ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
    >
      <div className="text-2xl font-bold font-display number-pop" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-text-tertiary mt-0.5">
        {label}
        {helpText && <HelpTip text={helpText} />}
      </div>
      {subtitle && (
        <div className="text-xs mt-0.5" style={{ color }}>
          {subtitle}
        </div>
      )}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="h-full">
        {card}
      </Link>
    );
  }
  return card;
}

/* ─── ReadinessCard (first card with HealthRing) ───────────── */

export function ReadinessCard({
  avgHealth,
  healthCount,
  healthLevel,
}: {
  avgHealth: number;
  healthCount: number;
  healthLevel: { label: string; color: string };
}) {
  return (
    <Link href="/readiness" className="h-full">
      <Card
        variant="elevated"
        padding="sm"
        className="p-4 h-full hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {healthCount > 0 ? (
            <HealthRing score={avgHealth} color={healthLevel.color} size={48} strokeWidth={4} />
          ) : (
            <div className="text-2xl font-bold font-display number-pop text-text-muted">--</div>
          )}
          <div>
            <div className="text-sm text-text-tertiary">
              My Readiness
              <HelpTip text="Weighted average of all process health scores. Key processes count 2x." />
            </div>
            {healthCount > 0 && (
              <div className="text-xs font-medium" style={{ color: healthLevel.color }}>
                {healthLevel.label}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ─── StatCardsRow — the full 5-card grid ──────────────────── */

export default function StatCardsRow({
  avgHealth,
  healthCount,
  healthLevel,
  excellenceReadyCount,
  processCount,
  needsAttentionCount,
  overdueMetricCount,
  overdueTaskCount,
  taskStats,
  orgAvgHealth,
  isMember,
}: {
  avgHealth: number;
  healthCount: number;
  healthLevel: { label: string; color: string };
  excellenceReadyCount: number;
  processCount: number;
  needsAttentionCount: number;
  overdueMetricCount: number;
  overdueTaskCount: number;
  taskStats: DashboardTaskStats | null;
  orgAvgHealth?: number;
  isMember?: boolean;
}) {
  const totalOverdue = overdueMetricCount + overdueTaskCount;

  // Build subtitle showing breakdown when both types exist
  let overdueSubtitle: string | undefined;
  if (totalOverdue > 0) {
    const parts: string[] = [];
    if (overdueMetricCount > 0)
      parts.push(`${overdueMetricCount} metric${overdueMetricCount !== 1 ? 's' : ''}`);
    if (overdueTaskCount > 0)
      parts.push(`${overdueTaskCount} task${overdueTaskCount !== 1 ? 's' : ''}`);
    overdueSubtitle = parts.join(', ');
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <ReadinessCard avgHealth={avgHealth} healthCount={healthCount} healthLevel={healthLevel} />
      <StatCard
        label="NIA Average"
        value={orgAvgHealth != null && orgAvgHealth > 0 ? orgAvgHealth : '--'}
        color={
          orgAvgHealth != null && orgAvgHealth > 0 && avgHealth > 0
            ? avgHealth >= orgAvgHealth
              ? '#b1bd37'
              : '#f79935'
            : 'var(--text-muted)'
        }
        subtitle={
          orgAvgHealth != null && orgAvgHealth > 0 && avgHealth > 0
            ? avgHealth >= orgAvgHealth
              ? "You're above average"
              : 'Below NIA average'
            : undefined
        }
        helpText="NIA's average process health score across all process owners."
      />
      <StatCard
        label="Needs Attention"
        value={needsAttentionCount}
        color={needsAttentionCount > 0 ? '#f79935' : '#b1bd37'}
        glow={needsAttentionCount > 0 ? 'orange' : undefined}
        href="/processes"
        helpText="Processes scoring 40-79 that need improvement work."
      />
      <StatCard
        label="Overdue"
        value={totalOverdue}
        color={totalOverdue > 0 ? '#dc2626' : '#b1bd37'}
        glow={totalOverdue > 0 ? 'red' : undefined}
        subtitle={overdueSubtitle}
        href="/data-health"
        helpText="Metrics past review date or tasks past due date."
      />
      <StatCard
        label="Active Tasks"
        value={taskStats?.totalActive ?? 0}
        color={taskStats && taskStats.totalActive > 0 ? '#55787c' : 'var(--text-muted)'}
        subtitle={
          taskStats && taskStats.totalActive + taskStats.totalCompleted > 0
            ? `${taskStats.completionRate}% complete`
            : undefined
        }
        helpText="In-progress tasks across all linked processes."
      />
    </div>
  );
}
