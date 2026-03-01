import { Card } from '@/components/ui';
import AdliRadar from '@/components/adli-radar';
import { DimBar } from '@/components/adli-bars';
import EmptyState from '@/components/empty-state';

export default function AdliOverview({
  dimAvgs,
  avgAdli,
  maturityLevel,
}: {
  dimAvgs: { approach: number; deployment: number; learning: number; integration: number } | null;
  avgAdli: number;
  maturityLevel: { label: string; color: string };
}) {
  return (
    <Card padding="md">
      <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
        ADLI Overview
      </h2>
      {dimAvgs ? (
        <>
          <div className="flex justify-center mb-4">
            <AdliRadar
              approach={dimAvgs.approach}
              deployment={dimAvgs.deployment}
              learning={dimAvgs.learning}
              integration={dimAvgs.integration}
              size={200}
            />
          </div>
          <div className="text-center mb-4">
            <span
              className="text-3xl font-bold font-display number-pop"
              style={{ color: maturityLevel.color }}
            >
              {avgAdli}%
            </span>
            <span className="text-sm font-medium ml-2" style={{ color: maturityLevel.color }}>
              {maturityLevel.label}
            </span>
          </div>
          <div className="space-y-3">
            <DimBar label="Approach" score={dimAvgs.approach} />
            <DimBar label="Deployment" score={dimAvgs.deployment} />
            <DimBar label="Learning" score={dimAvgs.learning} />
            <DimBar label="Integration" score={dimAvgs.integration} />
          </div>
        </>
      ) : (
        <EmptyState
          illustration="radar"
          title="No ADLI scores yet"
          description="Run an AI analysis on any process to see maturity scores here."
          compact
        />
      )}
    </Card>
  );
}
