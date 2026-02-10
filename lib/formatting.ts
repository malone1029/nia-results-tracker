/**
 * Shared formatting utilities for dates, times, and freshness indicators.
 * Extracted from page-level code to eliminate duplication.
 */

/**
 * Format an ISO date string as relative time ("Today", "3 days ago", "2 months ago").
 */
export function formatRelativeTime(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Get the freshness color for a date:
 * green (≤30d), gray (31-60d), orange (61-90d), red (90+d)
 */
export function getFreshnessColor(dateStr: string): string {
  const days = getFreshnessDays(dateStr);
  if (days <= 30) return "#b1bd37"; // NIA green
  if (days <= 60) return "#9ca3af"; // gray
  if (days <= 90) return "#f79935"; // NIA orange
  return "#dc2626"; // red
}

/**
 * Get number of days since the given date.
 */
export function getFreshnessDays(dateStr: string): number {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Deduplicate owners from a list of items that have an `owner` property.
 * Returns sorted unique owner names.
 */
export function getUniqueOwners(items: { owner: string | null }[]): string[] {
  const ownerSet = new Set<string>();
  for (const item of items) {
    if (item.owner) ownerSet.add(item.owner);
  }
  return [...ownerSet].sort();
}
