// lib/compliance.ts
// Pure compliance engine — takes pre-fetched data, returns pass/fail per check.
// "I'll accept progress. I won't accept a failure to use." — Jon Malone
//
// Compliance thresholds (adjust here if expectations change):
const PROCESS_UPDATE_WINDOW_DAYS = 90;     // must update process docs within 90 days
const TASK_COMPLETION_WINDOW_DAYS = 90;    // must complete at least 1 task per 90 days
const MIN_ACCEPTABLE_STATUS = ["ready_for_review", "approved"]; // at least one process must be here

// Metric cadence windows match lib/review-status.ts CADENCE_DAYS
// monthly=30, quarterly=90, semi-annual=182, annual=365
// We add a 20% grace buffer to avoid penalizing near-due metrics
const CADENCE_GRACE: Record<string, number> = {
  monthly: 36,
  quarterly: 108,
  "semi-annual": 218,
  annual: 438,
};

export interface MetricComplianceInput {
  cadence: string;
  lastEntryDate: string | null;
}

export interface ComplianceInput {
  onboardingCompletedAt: string | null;
  processes: {
    updated_at: string;
    status: string;
    metrics: MetricComplianceInput[];
    tasksCompletedDates: string[]; // completed_at values for tasks completed in system
  }[];
}

export interface ComplianceChecks {
  onboardingComplete: boolean;     // has completed onboarding program
  metricsAllCurrent: boolean;      // all linked metrics within cadence window (with grace)
  processRecentlyUpdated: boolean; // at least one process updated within 90 days
  taskCompletedThisQuarter: boolean; // at least one task completed in rolling 90 days
  processStatusAcceptable: boolean;  // at least one process at ready_for_review or approved
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

  // Check 1: Onboarding
  const onboardingComplete = !!input.onboardingCompletedAt;

  // Check 2: Metrics all current (cadence-aware with grace buffer)
  // A user with no processes or no metrics passes this check
  const allMetrics = input.processes.flatMap((p) => p.metrics);
  const metricsAllCurrent =
    allMetrics.length === 0 ||
    allMetrics.every((m) => {
      if (!m.lastEntryDate) return false; // no data = not current
      const grace = CADENCE_GRACE[m.cadence] ?? 438;
      return daysBetween(m.lastEntryDate, now) <= grace;
    });

  // Check 3: At least one process updated within 90 days
  const processRecentlyUpdated =
    input.processes.length === 0
      ? false
      : input.processes.some(
          (p) => daysBetween(p.updated_at, now) <= PROCESS_UPDATE_WINDOW_DAYS
        );

  // Check 4: At least one task completed in rolling 90 days
  const allCompletedDates = input.processes.flatMap((p) => p.tasksCompletedDates);
  const taskCompletedThisQuarter = allCompletedDates.some(
    (d) => daysBetween(d, now) <= TASK_COMPLETION_WINDOW_DAYS
  );

  // Check 5: At least one process at acceptable status
  const processStatusAcceptable =
    input.processes.length === 0
      ? false
      : input.processes.some((p) => MIN_ACCEPTABLE_STATUS.includes(p.status));

  const checks: ComplianceChecks = {
    onboardingComplete,
    metricsAllCurrent,
    processRecentlyUpdated,
    taskCompletedThisQuarter,
    processStatusAcceptable,
  };

  const isCompliant = Object.values(checks).every(Boolean);

  return { isCompliant, checks };
}
