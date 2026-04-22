import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

import {
  PRIORITY_META,
  STATUS_META,
  formatDate,
  formatDateTime,
  formatRelative,
} from './formatters';

describe('status/priority maps', () => {
  it('covers every status with a label and color', () => {
    for (const key of ['new', 'in_review', 'closed', 'lost'] as const) {
      expect(STATUS_META[key]).toBeDefined();
      expect(STATUS_META[key].label.length).toBeGreaterThan(0);
    }
  });

  it('covers every priority with a label and color', () => {
    for (const key of ['high', 'medium', 'low'] as const) {
      expect(PRIORITY_META[key]).toBeDefined();
      expect(PRIORITY_META[key].label.length).toBeGreaterThan(0);
    }
  });
});

describe('formatDate / formatDateTime', () => {
  it('returns em dash for null/undefined/empty', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns em dash for an unparseable string', () => {
    expect(formatDate('not a date')).toBe('—');
    expect(formatDateTime('also not a date')).toBe('—');
  });

  it('formats a valid ISO date to a human-readable string', () => {
    const out = formatDate('2026-04-21T12:00:00Z');
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Apr/);
  });

  it('formatDateTime includes time components', () => {
    const out = formatDateTime('2026-04-21T12:30:00Z');
    // Time rendering is locale-sensitive, so just assert the date parts + a colon.
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/:/);
  });
});

describe('formatRelative', () => {
  const NOW = new Date('2026-04-21T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for null/undefined/invalid', () => {
    expect(formatRelative(null)).toBe('');
    expect(formatRelative(undefined)).toBe('');
    expect(formatRelative('bogus')).toBe('');
  });

  it('returns "just now" when the delta rounds to < 1 minute', () => {
    expect(formatRelative(new Date(NOW - 10 * 1000).toISOString())).toBe('just now');
  });

  it('uses minute granularity under an hour', () => {
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString())).toBe('5m ago');
  });

  it('uses hour granularity under a day', () => {
    expect(formatRelative(new Date(NOW - 3 * 60 * 60_000).toISOString())).toBe('3h ago');
  });

  it('uses day granularity under a month', () => {
    expect(formatRelative(new Date(NOW - 4 * 24 * 60 * 60_000).toISOString())).toBe('4d ago');
  });

  it('falls back to absolute date beyond 30 days', () => {
    const iso = new Date(NOW - 60 * 24 * 60 * 60_000).toISOString();
    const out = formatRelative(iso);
    expect(out).not.toMatch(/ago$/);
    expect(out).toMatch(/2026/);
  });
});
