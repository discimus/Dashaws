import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cell } from '../types/cell';
import type { ExecutionResult } from './types';
import { BaseScheduler, type GetCell, type GetEnv, type OnResult } from './scheduler-base';
import type { ExecutorConfig } from './executor-core';
import type { CellsAPI, SandboxGlobals } from './types';
import { maskState } from './mask';

function makeCell(id: string, overrides?: Partial<Cell>): Cell {
  return {
    id,
    name: `Cell ${id}`,
    script: 'console.log("ok");',
    intervalMs: 1000,
    enabled: false,
    lastRunAt: null,
    status: 'idle',
    output: [],
    state: {},
    params: '{}',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function simpleCreateGlobals(
  _cellState: Record<string, unknown>,
  _env: Record<string, string>,
  _secrets: Set<string>,
  _secretsObj: Record<string, string>,
  _props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal,
  onLog: (entry: { timestamp: number; type: string; args: unknown[] }) => void
): SandboxGlobals {
  return {
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console: {
      log: (...args) => onLog({ timestamp: Date.now(), type: 'log', args }),
      warn: (...args) => onLog({ timestamp: Date.now(), type: 'warn', args }),
      error: (...args) => onLog({ timestamp: Date.now(), type: 'error', args }),
      info: (...args) => onLog({ timestamp: Date.now(), type: 'info', args }),
      table: (...args) => onLog({ timestamp: Date.now(), type: 'table', args }),
    },
    $state: _cellState,
    $env: _env,
    $secrets: _secretsObj,
    $props: _props,
    $queue: { enqueue: cellsApi.enqueue },
    $pubsub: { emit: cellsApi.emitEvent },
    signal,
    Math, Date, JSON, Array, Object, String, Number, Boolean,
    RegExp, Map, Set, Promise, parseInt, parseFloat, isNaN, isFinite,
    encodeURI, decodeURI,
    btoa: (data: string) => Buffer.from(data).toString('base64'),
    atob: (data: string) => Buffer.from(data, 'base64').toString(),
    ErrorConstructor: Error,
  };
}

const config: ExecutorConfig = {
  blockedGlobals: { Function: undefined },
  createGlobals: simpleCreateGlobals as ExecutorConfig['createGlobals'],
  maskState,
};

class TestScheduler extends BaseScheduler {
  protected override getCell: GetCell;
  protected override onResult: OnResult;
  private env: () => GetEnv;

  constructor(getCell: GetCell, onResult: OnResult, env: () => GetEnv) {
    super();
    this.getCell = getCell;
    this.onResult = onResult;
    this.env = env;
  }

  protected override getEnv(): GetEnv {
    return this.env();
  }

  protected override get executorConfig(): ExecutorConfig {
    return config;
  }

  protected override buildCellsAPI(): CellsAPI {
    return {
      enqueue: () => {},
      emitEvent: () => {},
    };
  }
}

describe('BaseScheduler', () => {
  let cell: Cell;
  let scheduler: TestScheduler;
  let results: Array<{ id: string; result: ExecutionResult }>;

  beforeEach(() => {
    vi.useFakeTimers();
    cell = makeCell('cell-1', { script: '$state.ran = true;' });
    results = [];

    scheduler = new TestScheduler(
      (id) => (id === cell.id ? cell : undefined),
      (id, result) => results.push({ id, result }),
      () => ({ env: {}, secrets: new Set(), secretsObj: {} })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runOnce executes a cell and calls onResult', async () => {
    const result = await scheduler.runOnce('cell-1');
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('cell-1');
  });

  it('runOnce returns null for nonexistent cellId', async () => {
    const result = await scheduler.runOnce('nonexistent');
    expect(result).toBeNull();
    expect(results).toHaveLength(0);
  });

  it('start executes immediately and sets interval', async () => {
    cell.intervalMs = 100;
    scheduler.start('cell-1');

    await vi.advanceTimersByTimeAsync(0);
    expect(results.length).toBeGreaterThanOrEqual(1);

    await vi.advanceTimersByTimeAsync(150);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('stop cancels interval', async () => {
    cell.intervalMs = 100;
    scheduler.start('cell-1');

    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.isRunning('cell-1')).toBe(true);

    scheduler.stop('cell-1');
    expect(scheduler.isRunning('cell-1')).toBe(false);

    const countBefore = results.length;
    await vi.advanceTimersByTimeAsync(200);
    expect(results.length).toBe(countBefore);
  });

  it('stopAll stops all running cells', async () => {
    const cell2 = makeCell('cell-2', { intervalMs: 100 });
    scheduler = new TestScheduler(
      (id) => (id === cell.id ? cell : id === cell2.id ? cell2 : undefined),
      (id, result) => results.push({ id, result }),
      () => ({ env: {}, secrets: new Set(), secretsObj: {} })
    );

    scheduler.start('cell-1');
    scheduler.start('cell-2');
    await vi.advanceTimersByTimeAsync(0);

    expect(scheduler.isRunning('cell-1')).toBe(true);
    expect(scheduler.isRunning('cell-2')).toBe(true);

    scheduler.stopAll();

    expect(scheduler.isRunning('cell-1')).toBe(false);
    expect(scheduler.isRunning('cell-2')).toBe(false);
  });

  it('restart stops and restarts', async () => {
    cell.enabled = true;
    cell.intervalMs = 100;
    scheduler.start('cell-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(results.length).toBe(1);

    scheduler.restart('cell-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(results.length).toBe(2);
  });

  it('multiple starts do not create multiple intervals', async () => {
    cell.intervalMs = 100;
    scheduler.start('cell-1');
    scheduler.start('cell-1');
    await vi.advanceTimersByTimeAsync(0);

    const countAfterFirstTick = results.length;
    await vi.advanceTimersByTimeAsync(200);
    expect(results.length).toBeLessThan(countAfterFirstTick + 4);
  });


});
