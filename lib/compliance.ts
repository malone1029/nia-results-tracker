// lib/compliance.ts
// Pure compliance engine — takes pre-fetched data, returns pass/fail per check.
// "I'll accept progress. I won't accept a failure to use." — Jon Malone
//
// Growth signal thresholds (adjust here if expectations change):
const HEALTH_SCORE_HEALTHY_THRESHOLD = 60; // "On Track" level
const ADLI_MATURE_THRESHOLD = 4;           // all dims ≥ 4 → considered mature
const ADLI_LOOKBACK_DAYS = 90;             // compare ADLI over rolling 90-day window

// Metric cadence windows (unchanged)
const CADENCE_GRACE: Record<string, number> = {
  monthly: 36,
  quarterly: 108,
  "semi-annual": 218,
  annual: 438,
};

export interface MetricComplianceInput {
  cadence: string;
  lastEntryDate: string | null;
  nextEntryExpected: string | null;
}

export interface AdliScorePoint {
  score: number;
  scoredAt: string;
}

export interface ComplianceInput {
  onboardingCompletedAt: string | null;
  processHealthScores: number[]; // actual health scores per owned process (0–100)
  processes: {
    metrics: MetricComplianceInput[];
    adliHistory: AdliScorePoint[];     // all ADLI scores for this process, newest first
    adliDimensions: {                  // latest ADLI dimension scores (null if never scored)
      approach: number;
      deployment: number;
      learning: number;
      integration: number;
    } | null;
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

function daysBetween(dateStr: string, now = new Date()): number {
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
        const nextDate = new Date(m.nextEntryExpected + "T00:00:00");
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

  // Check 4: ADLI maturity improving over time
  // Passes if ANY process meets one of:
  //   a) All 4 ADLI dimensions ≥ 4 (mature)
  //   b) Latest ADLI score > a score from ≥90 days ago (actively improving)
  //   c) Has a recent ADLI score within 90 days but no older comparison yet (first-time grace)
  // Fails entirely if no processes have any ADLI scores (not engaged with AI coach).
  const hasAnyAdliScore = input.processes.some((p) => p.adliHistory.length > 0);
  const adliImproving =
    input.processes.length === 0
      ? true
      : !hasAnyAdliScore
      ? false
      : input.processes.some((p) => {
          // (a) All dimensions mature
          if (p.adliDimensions) {
            const { approach, deployment, learning, integration } = p.adliDimensions;
            if (
              approach >= ADLI_MATURE_THRESHOLD &&
              deployment >= ADLI_MATURE_THRESHOLD &&
              learning >= ADLI_MATURE_THRESHOLD &&
              integration >= ADLI_MATURE_THRESHOLD
            )
              return true;
          }
          const latest = p.adliHistory[0];
          if (!latest) return false;
          // (b) Improvement over older score
          const olderScore = p.adliHistory.find(
            (s) => daysBetween(s.scoredAt, now) > ADLI_LOOKBACK_DAYS
          );
          if (olderScore) return latest.score > olderScore.score;
          // (c) First-time scorer grace: scored recently, no older comparison yet
          return daysBetween(latest.scoredAt, now) <= ADLI_LOOKBACK_DAYS;
        });

  const checks: ComplianceChecks = {
    onboardingComplete,
    metricsAllCurrent,
    healthScoreGrowing,
    adliImproving,
  };

  const isCompliant = Object.values(checks).every(Boolean);
  return { isCompliant, checks };
}
