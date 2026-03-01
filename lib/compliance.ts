// lib/compliance.ts
// Pure compliance engine — takes pre-fetched data, returns pass/fail per check.
// "I'll accept progress. I won't accept a failure to use." — Jon Malone
//
// Growth signal thresholds (adjust here if expectations change):
const HEALTH_SCORE_HEALTHY_THRESHOLD = 60; // "On Track" level
const ADLI_AVG_SCORE_THRESHOLD = 25; // avg ADLI across ALL owned processes (0–100, unassessed = 0)

// Metric cadence windows (unchanged)
const CADENCE_GRACE: Record<string, number> = {
  monthly: 36,
  quarterly: 108,
  'semi-annual': 218,
  annual: 438,
};

export interface MetricComplianceInput {
  cadence: string;
  lastEntryDate: string | null;
  nextEntryExpected: string | null;
}

export interface ComplianceInput {
  onboardingCompletedAt: string | null;
  processHealthScores: number[]; // actual health scores per owned process (0–100)
  avgAdliScore: number; // average ADLI overall score across ALL owned processes (unassessed = 0)
  processes: {
    metrics: MetricComplianceInput[];
  }[];
}

export interface ComplianceChecks {
  onboardingComplete: boolean;
  metricsAllCurrent: boolean;
  healthScoreGrowing: boolean;
  adliImproving: boolean;
}

export interface ComplianceResult {
  isCompliant: boolean;
  checks: ComplianceChecks;
}

function daysBetween(dateStr: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCompliance(input: ComplianceInput): ComplianceResult {
  const now = new Date();

  // Check 1: Onboarding complete
  const onboardingComplete = !!input.onboardingCompletedAt;

  // Check 2: All metrics current (cadence-aware with grace buffer, unchanged)
  const allMetrics = input.processes.flatMap((p) => p.metrics);
  const metricsAllCurrent =
    allMetrics.length === 0 ||
    allMetrics.every((m) => {
      if (m.nextEntryExpected) {
        const nextDate = new Date(m.nextEntryExpected + 'T00:00:00');
        if (nextDate > now) return true;
      }
      if (!m.lastEntryDate) return false;
      const grace = CADENCE_GRACE[m.cadence] ?? 438;
      return daysBetween(m.lastEntryDate, now) <= grace;
    });

  // Check 3: Health score at or above healthy threshold (≥60 = On Track)
  // Passes if at least one owned process has a real health score ≥ threshold.
  // Owners with no processes pass automatically.
  const healthScoreGrowing =
    input.processes.length === 0 ||
    input.processHealthScores.some((s) => s >= HEALTH_SCORE_HEALTHY_THRESHOLD);

  // Check 4: Average ADLI maturity score meets threshold
  // Computed across ALL owned processes — unassessed processes count as 0.
  // This creates a natural incentive to run AI assessments across the full portfolio,
  // not just cherry-pick one strong process.
  // Owners with no processes pass automatically.
  const adliImproving =
    input.processes.length === 0 || input.avgAdliScore >= ADLI_AVG_SCORE_THRESHOLD;

  const checks: ComplianceChecks = {
    onboardingComplete,
    metricsAllCurrent,
    healthScoreGrowing,
    adliImproving,
  };

  const isCompliant = Object.values(checks).every(Boolean);
  return { isCompliant, checks };
}
