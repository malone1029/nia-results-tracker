'use client';

import Link from 'next/link';
import HealthRing from '@/components/health-ring';

export interface SidebarHealthData {
  score: number;
  level: string;
  color: string;
  topAction: { label: string; href: string; points: number } | null;
  monthlyStreak: number;
  pendingSuggestions?: number;
}

export default function SidebarHealthWidget({
  data,
  loading,
  onNavigate,
}: {
  data: SidebarHealthData | null;
  loading?: boolean;
  onNavigate?: () => void;
}) {
  // Loading skeleton
  if (loading || !data) {
    return (
      <div className="mx-3 mt-3 rounded-lg bg-white/8 p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-[52px] h-[52px] rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-white/10 rounded w-10" />
            <div className="h-3 bg-white/10 rounded w-16" />
          </div>
        </div>
        <div className="mt-2.5 h-3 bg-white/10 rounded w-full" />
      </div>
    );
  }

  const { score, level, color, topAction, monthlyStreak, pendingSuggestions } = data;

  return (
    <Link
      href="/readiness"
      onClick={onNavigate}
      className="block mx-3 mt-3 rounded-lg bg-white/8 hover:bg-white/12 transition-colors p-3 group"
    >
      {/* Score row */}
      <div className="flex items-center gap-3">
        <HealthRing
          score={score}
          color={color}
          size={52}
          strokeWidth={4}
          showLabel={true}
          animate={false}
          className="flex-shrink-0 [&_span]:!text-sm [&_span]:!font-bold"
        />
        <div className="min-w-0">
          <div className="text-white/50 text-[10px] uppercase tracking-wide leading-none mb-0.5">
            NIA Average
          </div>
          <div className="text-white text-lg font-bold leading-tight">{score}</div>
          <div className="text-xs font-medium" style={{ color }}>
            {level}
          </div>
        </div>
      </div>

      {/* Top action */}
      {topAction && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-white/50 leading-tight">
          <svg
            className="w-3 h-3 text-nia-orange flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate">
            <span className="text-nia-orange font-medium">+{topAction.points} pts:</span>{' '}
            {topAction.label}
          </span>
        </div>
      )}

      {/* Monthly streak */}
      {monthlyStreak > 0 && (
        <div className="mt-1 text-[11px] text-white/40 leading-tight flex items-center gap-1">
          <span>🔥</span>
          <span>{monthlyStreak} this month</span>
        </div>
      )}

      {/* Pending suggestions badge */}
      {pendingSuggestions != null && pendingSuggestions > 0 && (
        <div className="mt-1.5 text-[11px] text-amber-400 leading-tight flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {pendingSuggestions} suggestion{pendingSuggestions > 1 ? 's' : ''} pending review
          </span>
        </div>
      )}
    </Link>
  );
}
