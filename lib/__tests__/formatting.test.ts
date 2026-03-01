import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  getFreshnessColor,
  getFreshnessDays,
  getUniqueOwners,
} from '../formatting';

describe('formatRelativeTime', () => {
  it('returns Today for current date', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('Today');
  });

  it('returns Yesterday for 1 day ago', () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(yesterday)).toBe('Yesterday');
  });

  it('returns X days ago for 2-6 days', () => {
    const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('3 days ago');
  });

  it('returns 1 week ago for 7-13 days', () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 week ago');
  });

  it('returns X weeks ago for 14-29 days', () => {
    const date = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('2 weeks ago');
  });

  it('returns 1 month ago for 30-59 days', () => {
    const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 month ago');
  });

  it('returns X months ago for 60-364 days', () => {
    const date = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('3 months ago');
  });

  it('returns Xy ago for 365+ days', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1y ago');
  });
});

describe('getFreshnessColor', () => {
  it('returns green for fresh dates (≤30 days)', () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(getFreshnessColor(date)).toBe('#b1bd37');
  });

  it('returns gray for 31-60 days', () => {
    const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    expect(getFreshnessColor(date)).toBe('#9ca3af');
  });

  it('returns orange for 61-90 days', () => {
    const date = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString();
    expect(getFreshnessColor(date)).toBe('#f79935');
  });

  it('returns red for 90+ days', () => {
    const date = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    expect(getFreshnessColor(date)).toBe('#dc2626');
  });
});

describe('getFreshnessDays', () => {
  it('returns 0 for today', () => {
    expect(getFreshnessDays(new Date().toISOString())).toBe(0);
  });

  it('returns correct number of days', () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(getFreshnessDays(date)).toBe(10);
  });
});

describe('getUniqueOwners', () => {
  it('returns unique sorted owners', () => {
    const items = [
      { owner: 'Zach' },
      { owner: 'Alice' },
      { owner: 'Zach' },
      { owner: null },
      { owner: 'Bob' },
    ];
    expect(getUniqueOwners(items)).toEqual(['Alice', 'Bob', 'Zach']);
  });

  it('returns empty array when no owners', () => {
    expect(getUniqueOwners([{ owner: null }, { owner: null }])).toEqual([]);
  });

  it('handles empty input', () => {
    expect(getUniqueOwners([])).toEqual([]);
  });
});
