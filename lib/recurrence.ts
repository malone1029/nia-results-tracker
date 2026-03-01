/**
 * Recurrence rule utilities for repeating tasks.
 *
 * RecurrenceRule is stored as JSONB on process_tasks.recurrence_rule.
 * When a recurring task is completed, a new task is spawned with the
 * next due date computed from these rules.
 */

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // every N days/weeks/months
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  endDate?: string; // optional ISO date string to stop recurring
}

/**
 * Compute the next due date from a completed date and recurrence rule.
 * Returns null if the recurrence has ended (past endDate).
 */
export function computeNextDueDate(
  completedDate: string | Date,
  rule: RecurrenceRule
): string | null {
  const base = new Date(completedDate);
  // Work in UTC to avoid timezone issues
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();

  let next: Date;

  switch (rule.type) {
    case 'daily':
      next = new Date(Date.UTC(year, month, day + rule.interval));
      break;

    case 'weekly': {
      // Advance by N weeks from the completed date
      next = new Date(Date.UTC(year, month, day + 7 * rule.interval));
      // If a specific day of week is set, adjust to the next occurrence
      if (rule.dayOfWeek !== undefined) {
        const currentDay = next.getUTCDay();
        const diff = (rule.dayOfWeek - currentDay + 7) % 7;
        if (diff > 0) {
          next = new Date(next.getTime() + diff * 86400000);
        }
      }
      break;
    }

    case 'monthly': {
      const targetMonth = month + rule.interval;
      const targetDay = rule.dayOfMonth || day;
      // Handle month overflow (e.g. Jan 31 + 1 month = Feb 28)
      next = new Date(Date.UTC(year, targetMonth, 1));
      const lastDayOfMonth = new Date(
        Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
      ).getUTCDate();
      next.setUTCDate(Math.min(targetDay, lastDayOfMonth));
      break;
    }

    default:
      return null;
  }

  // Check if past end date
  if (rule.endDate) {
    const end = new Date(rule.endDate + 'T23:59:59Z');
    if (next > end) return null;
  }

  return next.toISOString().slice(0, 10);
}

/**
 * Human-readable description of a recurrence rule.
 */
export function describeRecurrence(rule: RecurrenceRule): string {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  switch (rule.type) {
    case 'daily':
      if (rule.interval === 1) return 'Every day';
      return `Every ${rule.interval} days`;

    case 'weekly':
      if (rule.dayOfWeek !== undefined) {
        const dayName = DAYS[rule.dayOfWeek];
        if (rule.interval === 1) return `Every ${dayName}`;
        return `Every ${rule.interval} weeks on ${dayName}`;
      }
      if (rule.interval === 1) return 'Every week';
      return `Every ${rule.interval} weeks`;

    case 'monthly':
      if (rule.dayOfMonth) {
        const suffix =
          rule.dayOfMonth === 1 || rule.dayOfMonth === 21 || rule.dayOfMonth === 31
            ? 'st'
            : rule.dayOfMonth === 2 || rule.dayOfMonth === 22
              ? 'nd'
              : rule.dayOfMonth === 3 || rule.dayOfMonth === 23
                ? 'rd'
                : 'th';
        if (rule.interval === 1) return `Monthly on the ${rule.dayOfMonth}${suffix}`;
        return `Every ${rule.interval} months on the ${rule.dayOfMonth}${suffix}`;
      }
      if (rule.interval === 1) return 'Every month';
      return `Every ${rule.interval} months`;

    default:
      return 'Recurring';
  }
}

/**
 * Validate a RecurrenceRule object. Returns null if valid, error message if not.
 */
export function validateRecurrenceRule(rule: unknown): string | null {
  if (!rule || typeof rule !== 'object') return 'Invalid recurrence rule';

  const r = rule as Record<string, unknown>;
  if (!['daily', 'weekly', 'monthly'].includes(r.type as string)) {
    return 'Type must be daily, weekly, or monthly';
  }
  if (typeof r.interval !== 'number' || r.interval < 1 || r.interval > 365) {
    return 'Interval must be between 1 and 365';
  }
  if (r.dayOfWeek !== undefined) {
    if (typeof r.dayOfWeek !== 'number' || r.dayOfWeek < 0 || r.dayOfWeek > 6) {
      return 'dayOfWeek must be 0-6';
    }
  }
  if (r.dayOfMonth !== undefined) {
    if (typeof r.dayOfMonth !== 'number' || r.dayOfMonth < 1 || r.dayOfMonth > 31) {
      return 'dayOfMonth must be 1-31';
    }
  }
  if (r.endDate !== undefined && typeof r.endDate !== 'string') {
    return 'endDate must be an ISO date string';
  }
  return null;
}
