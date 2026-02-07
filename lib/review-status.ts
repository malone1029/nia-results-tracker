// US-008: Review cadence logic
// Determines if a metric is current, due soon, overdue, or has no data

export type ReviewStatus = "current" | "due-soon" | "overdue" | "no-data";

const CADENCE_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  "semi-annual": 182,
  annual: 365,
};

const DUE_SOON_BUFFER_DAYS = 7;

export function getReviewStatus(
  cadence: string,
  lastEntryDate: string | null
): ReviewStatus {
  if (!lastEntryDate) return "no-data";

  const now = new Date();
  const lastDate = new Date(lastEntryDate);
  const daysSinceLastEntry = Math.floor(
    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const cadenceDays = CADENCE_DAYS[cadence] || 365;

  if (daysSinceLastEntry > cadenceDays) {
    return "overdue";
  }

  if (daysSinceLastEntry > cadenceDays - DUE_SOON_BUFFER_DAYS) {
    return "due-soon";
  }

  return "current";
}

export function getStatusColor(status: ReviewStatus): string {
  switch (status) {
    case "current":
      return "#b1bd37"; // NIA green
    case "due-soon":
      return "#f79935"; // NIA orange
    case "overdue":
      return "#dc2626"; // red
    case "no-data":
      return "#dc2626"; // red
  }
}

export function getStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case "current":
      return "Current";
    case "due-soon":
      return "Due Soon";
    case "overdue":
      return "Overdue";
    case "no-data":
      return "No Data";
  }
}

// Format a date string like "2025-01-15" to "Jan 15, 2025"
export function formatDate(date: string | null): string {
  if (!date) return "Never";
  const d = new Date(date + "T00:00:00"); // avoid timezone shift
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Convert a date to NIA fiscal year label (July 1 - June 30)
// July 2024 through June 2025 = FY25
export function toFiscalYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = d.getMonth(); // 0-indexed (0 = January, 6 = July)
  const year = d.getFullYear();

  // If July or later, fiscal year is next calendar year
  const fy = month >= 6 ? year + 1 : year;
  return `FY${String(fy).slice(-2)}`;
}

// Determine trend direction from recent values
export function getTrendDirection(
  values: number[],
  isHigherBetter: boolean
): "improving" | "declining" | "flat" | "insufficient" {
  if (values.length < 3) return "insufficient";

  // Look at the last 3 values
  const recent = values.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;

  // Consider "flat" if change is less than 2% of the first value
  const threshold = Math.abs(first) * 0.02;
  if (Math.abs(diff) <= threshold) return "flat";

  const isRising = diff > 0;
  if (isHigherBetter) {
    return isRising ? "improving" : "declining";
  } else {
    return isRising ? "declining" : "improving";
  }
}
