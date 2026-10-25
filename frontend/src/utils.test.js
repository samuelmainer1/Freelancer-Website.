import { describe, expect, it, vi, afterEach } from 'vitest';
import { budgetRange, formatDate, money, timeAgo } from './utils.js';

describe('money', () => {
  it('formats with thousands separators and a dollar sign', () => {
    expect(money(1500)).toBe('$1,500');
    expect(money(0)).toBe('$0');
  });

  it('returns null for missing or non-numeric input', () => {
    expect(money(null)).toBeNull();
    expect(money(undefined)).toBeNull();
    expect(money('abc')).toBeNull();
  });

  it('accepts numeric strings', () => {
    expect(money('2500')).toBe('$2,500');
  });
});

describe('budgetRange', () => {
  it('shows a range when both bounds exist', () => {
    expect(budgetRange(1000, 2000)).toBe('$1,000 – $2,000');
  });

  it('handles a min-only budget', () => {
    expect(budgetRange(500, null)).toBe('From $500');
  });

  it('handles a max-only budget', () => {
    expect(budgetRange(null, 800)).toBe('Up to $800');
  });

  it('falls back to Negotiable when neither bound exists', () => {
    expect(budgetRange(null, null)).toBe('Negotiable');
  });
});

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers());

  // Timestamps arrive as SQLite UTC strings ("YYYY-MM-DD HH:MM:SS").
  const ago = (ms) => new Date(Date.now() - ms).toISOString().slice(0, 19).replace('T', ' ');

  it('returns an empty string for missing input', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo('')).toBe('');
  });

  it('describes sub-minute ages as "just now"', () => {
    expect(timeAgo(ago(30 * 1000))).toBe('just now');
  });

  it('describes minutes, hours and days', () => {
    expect(timeAgo(ago(5 * 60 * 1000))).toBe('5m ago');
    expect(timeAgo(ago(3 * 60 * 60 * 1000))).toBe('3h ago');
    expect(timeAgo(ago(4 * 24 * 60 * 60 * 1000))).toBe('4d ago');
  });

  it('treats the timestamp as UTC, not local time', () => {
    // A timestamp 10 minutes in the past must read "10m ago" regardless of the
    // machine's timezone; misparsing it as local time would shift it by hours.
    expect(timeAgo(ago(10 * 60 * 1000))).toBe('10m ago');
  });
});

describe('formatDate', () => {
  it('formats a date-only string', () => {
    expect(formatDate('2026-03-05')).toBe('Mar 5, 2026');
  });

  it('returns an empty string for missing input', () => {
    expect(formatDate(null)).toBe('');
  });
});
