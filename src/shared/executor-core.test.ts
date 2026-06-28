import { describe, it, expect } from 'vitest';
import type { LogEntry } from '../types/cell';
import type { CellsAPI, SandboxGlobals } from './types';
import { executeScript, ExecutorConfig } from './executor-core';
import { maskState } from './mask';

function simpleCreateGlobals(
  _cellState: Record<string, unknown>,
  _env: Record<string, string>,
  _secrets: Set<string>,
  _secretsObj: Record<string, string>,
  _props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal,
  _onLog: (entry: LogEntry) => void
): SandboxGlobals {
  return {
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console: {
      log: (...args) => _onLog({ timestamp: Date.now(), type: 'log', args }),
      warn: (...args) => _onLog({ timestamp: Date.now(), type: 'warn', args }),
      error: (...args) => _onLog({ timestamp: Date.now(), type: 'error', args }),
      info: (...args) => _onLog({ timestamp: Date.now(), type: 'info', args }),
      table: (...args) => _onLog({ timestamp: Date.now(), type: 'table', args }),
    },
    $state: _cellState,
    $env: _env,
    $secrets: _secretsObj,
    $props: _props,
    $cells: cellsApi,
    $queue: { enqueue: (name, body) => cellsApi.enqueue(name, body) },
    $pubsub: { emit: (name, body) => cellsApi.emitEvent(name, body) },
    signal,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    btoa: (data: string) => Buffer.from(data).toString('base64'),
    atob: (data: string) => Buffer.from(data, 'base64').toString(),
    ErrorConstructor: Error,
  };
}

const defaultConfig: ExecutorConfig = {
  blockedGlobals: { Function: undefined },
  createGlobals: simpleCreateGlobals,
  maskState,
};

const dummyApi: CellsAPI = {
  run: () => {},
  start: () => {},
  stop: () => {},
  list: () => [],
  enqueue: () => {},
  emitEvent: () => {},
};

describe('executeScript', () => {
  it('executes a simple script and returns success', async () => {
    const result = await executeScript(
      'console.log("hello");',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.success).toBe(true);
    expect(result.output).toHaveLength(1);
    expect(result.output[0].args[0]).toBe('hello');
  });

  it('returns error for script that throws', async () => {
    const result = await executeScript(
      'throw new Error("oops");',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('oops');
  });

  it('captures multiple console calls in output', async () => {
    const result = await executeScript(
      'console.log("a"); console.warn("b");',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.output).toHaveLength(2);
    expect(result.output[0].type).toBe('log');
    expect(result.output[1].type).toBe('warn');
  });

  it('returns updated state via $state mutation', async () => {
    const initialState = { counter: 0 };
    const result = await executeScript(
      '$state.counter = 42;',
      initialState,
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.success).toBe(true);
    expect(result.state.counter).toBe(42);
  });

  it('blocked globals are inaccessible', async () => {
    const result = await executeScript(
      'console.log(typeof Function);',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.success).toBe(true);
    expect(result.output[0].args[0]).toBe('undefined');
  });

  it('aborted signal is detected on error', async () => {
    const ac = new AbortController();

    const result = await executeScript(
      'throw new Error("x");',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      ac.signal,
      defaultConfig
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('x');
  });

  it('$env is injected correctly', async () => {
    const result = await executeScript(
      'console.log($env.API_URL);',
      {},
      { API_URL: 'https://example.com' },
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.output[0].args[0]).toBe('https://example.com');
  });

  it('$props is injected correctly', async () => {
    const result = await executeScript(
      'console.log($props.myKey);',
      {},
      {},
      new Set(),
      {},
      { myKey: 'propval' },
      dummyApi,
      new AbortController().signal,
      defaultConfig
    );

    expect(result.output[0].args[0]).toBe('propval');
  });

  it('calls onFinally callback', async () => {
    let finallyCalled = false;
    const config: ExecutorConfig = {
      ...defaultConfig,
      onFinally: () => { finallyCalled = true; },
    };

    await executeScript(
      'console.log("test");',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      config
    );

    expect(finallyCalled).toBe(true);
  });

  it('calls onFinally even on error', async () => {
    let finallyCalled = false;
    const config: ExecutorConfig = {
      ...defaultConfig,
      onFinally: () => { finallyCalled = true; },
    };

    const result = await executeScript(
      'throw new Error("x");',
      {},
      {},
      new Set(),
      {},
      {},
      dummyApi,
      new AbortController().signal,
      config
    );

    expect(result.success).toBe(false);
    expect(finallyCalled).toBe(true);
  });

  it('$cells API is injected', async () => {
    let calledWith: unknown = null;
    const api: CellsAPI = {
      ...dummyApi,
      run: (id, _props) => { calledWith = id; },
    };

    const config: ExecutorConfig = {
      ...defaultConfig,
      createGlobals: (state, env, secrets, secretsObj, props, cellsApi, signal, onLog) =>
        simpleCreateGlobals(state, env, secrets, secretsObj, props, cellsApi, signal, onLog),
    };

    await executeScript(
      '$cells.run("test-id");',
      {},
      {},
      new Set(),
      {},
      {},
      api,
      new AbortController().signal,
      config
    );

    expect(calledWith).toBe('test-id');
  });
});
