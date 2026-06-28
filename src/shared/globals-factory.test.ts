import { describe, it, expect, vi } from 'vitest';
import type { LogEntry } from '../types/cell';
import { createConsoleProxy, createTrackedSetTimeout, createTrackedClearTimeout } from './globals-factory';

describe('createConsoleProxy', () => {
  it('captures console.log with timestamp and type log', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.log('hello');

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('log');
    expect(entries[0].args).toEqual(['hello']);
  });

  it('captures console.warn with type warn', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.warn('warning');

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('warn');
  });

  it('captures console.error with type error', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.error('oops');

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('error');
  });

  it('captures console.info with type info', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.info('info msg');

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('info');
  });

  it('captures console.table with type table', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.table([{ id: 1 }]);

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('table');
  });

  it('masks arguments when secrets is non-empty', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(['secret']), onLog);

    console.log('the secret is out');

    expect(entries[0].args[0]).not.toContain('secret');
  });

  it('does not mask arguments when secrets is empty', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.log('plain text');

    expect(entries[0].args[0]).toBe('plain text');
  });

  it('handles multiple arguments', () => {
    const entries: LogEntry[] = [];
    const onLog = (entry: LogEntry) => entries.push(entry);
    const console = createConsoleProxy(new Set(), onLog);

    console.log('a', 1, true, { key: 'val' });

    expect(entries[0].args).toHaveLength(4);
  });
});

describe('createTrackedSetTimeout / createTrackedClearTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks timeout IDs', () => {
    const timerIds = new Set<number>();
    const setTimeout = createTrackedSetTimeout(timerIds);
    const fn = vi.fn();

    const id = setTimeout(fn, 100);
    expect(timerIds.has(id)).toBe(true);

    vi.advanceTimersByTime(200);
    expect(timerIds.has(id)).toBe(false);
  });

  it('clearTimeout removes from tracker', () => {
    const timerIds = new Set<number>();
    const setTimeout = createTrackedSetTimeout(timerIds);
    const clearTimeout = createTrackedClearTimeout(timerIds);
    const fn = vi.fn();

    const id = setTimeout(fn, 100);
    clearTimeout(id);

    expect(timerIds.has(id)).toBe(false);
  });

  it('clearTimeout with undefined does not throw', () => {
    const timerIds = new Set<number>();
    const clearTimeout = createTrackedClearTimeout(timerIds);
    expect(() => clearTimeout(undefined)).not.toThrow();
  });

  it('multiple timeouts are all tracked', () => {
    const timerIds = new Set<number>();
    const setTimeout = createTrackedSetTimeout(timerIds);
    const fn = vi.fn();

    const id1 = setTimeout(fn, 100);
    const id2 = setTimeout(fn, 200);
    const id3 = setTimeout(fn, 300);

    expect(timerIds.size).toBe(3);
  });
});
