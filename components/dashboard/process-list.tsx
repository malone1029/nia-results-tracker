import Link from "next/link";
import { Card, CardHeader, Badge } from "@/components/ui";
import HealthRing from "@/components/health-ring";
import { MiniBar } from "@/components/adli-bars";
import type { ProcessWithCategory } from "@/lib/fetch-health-data";
import type { HealthResult } from "@/lib/process-health";
import type { ScoreRow } from "./types";

export default function ProcessList({
  processes,
  healthScores,
  scoreMap,
  isAllOwners,
}: {
  processes: ProcessWithCategory[];
  healthScores: Map<number, HealthResult>;
  scoreMap: Map<number, ScoreRow>;
  isAllOwners: boolean;
}) {
  // Map health levels to accent colors for left border
  const getAccentColor = (health: HealthResult | undefined) => {
    if (!health) return "var(--border-light)";
    if (health.total >= 80) return "#b1bd37";
    if (health.total >= 60) return "#55787c";
    if (health.total >= 40) return "#f79935";
    return "#dc2626";
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">
          {isAllOwners ? "All Processes" : "My Processes"}
        </h2>
      </CardHeader>
      <div className="divide-y divide-border-light">
        {processes.map((proc) => {
          const score = scoreMap.get(proc.id);
          const health = healthScores.get(proc.id);
          const accentColor = getAccentColor(health);

          return (
            <Link
              key={proc.id}
              href={`/processes/${proc.id}`}
              className="block px-5 py-3 hover:bg-surface-hover/80 transition-colors"
              style={{ borderLeft: `3px solid ${accentColor}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {health && (
                    <HealthRing
                      score={health.total}
                      color={health.level.color}
                      size={28}
                      strokeWidth={2.5}
                      className="text-[8px] flex-shrink-0"
                    />
                  )}
                  <span className="text-sm font-medium text-nia-dark truncate">
                    {proc.name}
                  </span>
                  {proc.process_type === "key" && (
                    <Badge color="orange" size="xs" pill={false}>
                      KEY
                    </Badge>
                  )}
                  {proc.process_type === "support" && (
                    <span className="text-[10px] text-text-muted">Support</span>
                  )}
                  {proc.asana_project_gid && (
                    <svg
                      className="w-3.5 h-3.5 text-text-muted flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-label="Linked to Asana"
                    >
                      <circle cx="12" cy="6" r="4.5" />
                      <circle cx="5" cy="18" r="4.5" />
                      <circle cx="19" cy="18" r="4.5" />
                    </svg>
                  )}
                </div>
              </div>
              {score && (
                <div className="grid grid-cols-4 gap-2">
                  <MiniBar label="A" score={score.approach_score} />
                  <MiniBar label="D" score={score.deployment_score} />
                  <MiniBar label="L" score={score.learning_score} />
                  <MiniBar label="I" score={score.integration_score} />
                </div>
              )}
              <div className="text-[10px] text-text-muted mt-1">
                {proc.category_display_name}
                {proc.owner && ` \u00b7 ${proc.owner}`}
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
