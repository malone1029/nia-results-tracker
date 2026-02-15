import Link from "next/link";
import { Card } from "@/components/ui";
import HealthRing from "@/components/health-ring";

/* ─── Progress Momentum + Recent Wins ──────────────────────── */

export function MomentumAndWins({
  monthlyImprovedCount,
  wins,
}: {
  monthlyImprovedCount: number;
  wins: { emoji: string; text: string; health?: number; color?: string }[];
}) {
  if (monthlyImprovedCount === 0 && wins.length === 0) return null;

  return (
    <Card padding="md">
      {monthlyImprovedCount > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-nia-green/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm">{"\uD83D\uDD25"}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-nia-dark">
              {monthlyImprovedCount} process{monthlyImprovedCount !== 1 ? "es" : ""} improved this month
            </div>
            <div className="text-xs text-text-muted">Keep the momentum going!</div>
          </div>
        </div>
      )}

      {wins.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Recent Wins
          </h3>
          <div className="space-y-1.5">
            {wins.map((win, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-sm flex-shrink-0">{win.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-nia-dark truncate block">{win.text}</span>
                </div>
                {win.health !== undefined && (
                  <HealthRing
                    score={win.health}
                    color={win.color || "#b1bd37"}
                    size={22}
                    strokeWidth={2}
                    className="text-[7px] flex-shrink-0"
                    animate={false}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ─── Recent Activity (org-wide, only shown for "All Owners") ─ */

export function RecentActivity({
  improvements,
}: {
  improvements: { processId: number; processName: string; label: string; date: string }[];
}) {
  if (improvements.length === 0) return null;

  return (
    <Card padding="md">
      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
        Recent Activity
      </h2>
      <div className="space-y-1">
        {improvements.slice(0, 5).map((imp, i) => {
          const daysAgo = Math.floor(
            (Date.now() - new Date(imp.date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const timeLabel =
            daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
          return (
            <Link
              key={i}
              href={`/processes/${imp.processId}`}
              className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-surface-hover transition-colors group"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-nia-green mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-nia-dark group-hover:text-nia-orange transition-colors">
                  <span className="font-medium">{imp.processName}</span>
                  {" \u2014 "}
                  {imp.label}
                </span>
              </div>
              <span className="text-[10px] text-text-muted flex-shrink-0 mt-px">{timeLabel}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
