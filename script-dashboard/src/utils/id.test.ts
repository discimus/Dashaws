import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripComments, generateId, formatTimeAgo } from './id';

describe('stripComments', () => {
  it('removes single-line JS comments', () => {
    expect(stripComments('const x = 1;\n// this is a comment\nconst y = 2;'))
      .toBe('const x = 1;\n\nconst y = 2;');
  });

  it('removes block comments', () => {
    expect(stripComments('const x = /* inline */ 1;'))
      .toBe('const x =  1;');
  });

  it('removes multi-line block comments', () => {
    expect(stripComments('a/*\nmulti\nline\n*/b'))
      .toBe('ab');
  });

  it('removes hash comments (Python)', () => {
    expect(stripComments('# this is a comment\nprint(1)'))
      .toBe('# this is a comment\nprint(1)');
  });

  it('handles scripts with no comments', () => {
    expect(stripComments('console.log("hello");'))
      .toBe('console.log("hello");');
  });

  it('handles empty strings', () => {
    expect(stripComments('')).toBe('');
  });

  it('removes comments at start of line with leading whitespace', () => {
    expect(stripComments('  // comment\ncode'))
      .toBe('\ncode');
  });

  it('does not remove // inside strings', () => {
    expect(stripComments('const url = "https://example.com";'))
      .toBe('const url = "https://example.com";');
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('returns a UUID-format string when crypto.randomUUID is available', () => {
    const id = generateId();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('formatTimeAgo', () => {
  const now = 1700000000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Never" for null', () => {
    expect(formatTimeAgo(null)).toBe('Never');
  });

  it('returns "Just now" for less than 5 seconds', () => {
    expect(formatTimeAgo(now - 1000)).toBe('Just now');
    expect(formatTimeAgo(now - 4999)).toBe('Just now');
  });

  it('returns seconds ago', () => {
    expect(formatTimeAgo(now - 5000)).toBe('5s ago');
    expect(formatTimeAgo(now - 59000)).toBe('59s ago');
  });

  it('returns minutes ago', () => {
    expect(formatTimeAgo(now - 60000)).toBe('1m ago');
    expect(formatTimeAgo(now - 59 * 60000)).toBe('59m ago');
  });

  it('returns hours ago', () => {
    expect(formatTimeAgo(now - 60 * 60000)).toBe('1h ago');
    expect(formatTimeAgo(now - 23 * 60 * 60000)).toBe('23h ago');
  });

  it('returns days ago', () => {
    expect(formatTimeAgo(now - 24 * 60 * 60000)).toBe('1d ago');
    expect(formatTimeAgo(now - 365 * 24 * 60 * 60000)).toBe('365d ago');
  });
});
