"use client";

import AdliRadar from "./adli-radar";
import { getMaturityLevel } from "@/lib/colors";
import type { AdliScores } from "@/lib/ai-parsers";

export default function AdliScorecard({ scores, onImprove, isLoading }: { scores: AdliScores; onImprove?: (dimension: string) => void; isLoading?: boolean }) {
  const dimensions = [
    { key: "approach" as const, label: "Approach" },
    { key: "deployment" as const, label: "Deployment" },
    { key: "learning" as const, label: "Learning" },
    { key: "integration" as const, label: "Integration" },
  ];

  // Sort by score ascending so user can see weakest first
  const sorted = [...dimensions].sort((a, b) => scores[a.key] - scores[b.key]);

  const overall = Math.round(
    (scores.approach + scores.deployment + scores.learning + scores.integration) / 4
  );
  const overallLevel = getMaturityLevel(overall);

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-nia-dark">ADLI Assessment</h3>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: overallLevel.bgColor }}
        >
          {overall}% — {overallLevel.label}
        </span>
      </div>

      {/* Radar visualization */}
      <div className="flex justify-center py-1">
        <AdliRadar
          approach={scores.approach}
          deployment={scores.deployment}
          learning={scores.learning}
          integration={scores.integration}
          size={160}
          color={overallLevel.bgColor}
        />
      </div>

      {/* Dimension bars with improve buttons */}
      <div className="space-y-2">
        {sorted.map(({ key, label }) => {
          const score = scores[key];
          const level = getMaturityLevel(score);

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-tertiary w-20">{label}</span>
              <div className="flex-1 bg-surface-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    backgroundColor: level.bgColor,
                  }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right" style={{ color: level.color }}>
                {score}%
              </span>
              {onImprove && (
                <button
                  onClick={() => onImprove(key)}
                  disabled={isLoading}
                  className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium disabled:opacity-40 whitespace-nowrap"
                >
                  Improve
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
