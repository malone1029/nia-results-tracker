import { describe, it, expect } from 'vitest';
import {
  getReviewStatus,
  getStatusColor,
  getStatusLabel,
  formatDate,
  toFiscalYear,
  formatValue,
  getTrendDirection,
} from '../review-status';

describe('getReviewStatus', () => {
  it('returns no-data when lastEntryDate is null', () => {
    expect(getReviewStatus('monthly', null)).toBe('no-data');
  });

  it('returns current when entry is recent', () => {
    const today = new Date().toISOString();
    expect(getReviewStatus('monthly', today)).toBe('current');
  });

  it('returns overdue when entry exceeds cadence', () => {
    const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    expect(getReviewStatus('monthly', old)).toBe('overdue');
  });

  it('returns due-soon when within buffer', () => {
    // Monthly = 30 days, buffer = 7 days. 25 days ago = within 30-7..30 window
    const date = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
    expect(getReviewStatus('monthly', date)).toBe('due-soon');
  });

  it('defaults to annual cadence for unknown cadence strings', () => {
    const date = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(getReviewStatus('unknown-cadence', date)).toBe('current');
  });
});

describe('getStatusColor', () => {
  it('returns green for current', () => {
    expect(getStatusColor('current')).toBe('#b1bd37');
  });

  it('returns orange for due-soon', () => {
    expect(getStatusColor('due-soon')).toBe('#f79935');
  });

  it('returns red for overdue', () => {
    expect(getStatusColor('overdue')).toBe('#dc2626');
  });

  it('returns red for no-data', () => {
    expect(getStatusColor('no-data')).toBe('#dc2626');
  });
});

describe('getStatusLabel', () => {
  it('returns readable labels', () => {
    expect(getStatusLabel('current')).toBe('Current');
    expect(getStatusLabel('due-soon')).toBe('Due Soon');
    expect(getStatusLabel('overdue')).toBe('Overdue');
    expect(getStatusLabel('no-data')).toBe('No Data');
  });
});

describe('formatDate', () => {
  it('returns Never for null', () => {
    expect(formatDate(null)).toBe('Never');
  });

  it('formats a date string', () => {
    // formatDate appends T00:00:00 to avoid timezone shift
    const result = formatDate('2025-01-15');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });
});

describe('toFiscalYear', () => {
  it('returns FY25 for dates in July 2024 through June 2025', () => {
    // Use mid-month dates to avoid timezone edge cases (July 1 UTC = June 30 local)
    expect(toFiscalYear('2024-07-15')).toBe('FY25');
    expect(toFiscalYear('2025-06-15')).toBe('FY25');
  });

  it('returns FY26 for mid-July 2025+', () => {
    expect(toFiscalYear('2025-07-15')).toBe('FY26');
  });

  it('returns FY25 for January 2025', () => {
    expect(toFiscalYear('2025-01-15')).toBe('FY25');
  });
});

describe('formatValue', () => {
  it('returns — for null', () => {
    expect(formatValue(null, '%')).toBe('—');
  });

  it('appends % for percentage unit', () => {
    expect(formatValue(95, '%')).toBe('95%');
  });

  it('formats currency with $ and 2 decimals', () => {
    expect(formatValue(42, 'currency')).toBe('$42.00');
  });

  it('adds unit as suffix for other units', () => {
    expect(formatValue(5, 'hours')).toBe('5 hours');
  });
});

describe('getTrendDirection', () => {
  it('returns insufficient for fewer than 3 values', () => {
    expect(getTrendDirection([10, 20], true)).toBe('insufficient');
  });

  it('returns improving for rising values when higher is better', () => {
    expect(getTrendDirection([80, 85, 90], true)).toBe('improving');
  });

  it('returns declining for rising values when lower is better', () => {
    expect(getTrendDirection([80, 85, 90], false)).toBe('declining');
  });

  it('returns flat when change is within 2% threshold', () => {
    expect(getTrendDirection([100, 100, 101], true)).toBe('flat');
  });

  it('returns declining for dropping values when higher is better', () => {
    expect(getTrendDirection([90, 85, 80], true)).toBe('declining');
  });
});
