import type { LogEntry } from '../../src/types/cell.js';

export interface ServerSandboxGlobals {
  fetch: typeof globalThis.fetch;
  setTimeout: (fn: TimerHandler, ms?: number, ...args: unknown[]) => number;
  clearTimeout: (id: number | undefined) => void;
  console: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    table: (...args: unknown[]) => void;
  };
  $state: Record<string, unknown>;
  $env: Record<string, string>;
  $secrets: Record<string, string>;
  $props: Record<string, unknown>;
  $cells: {
    run: (id: string, props?: Record<string, unknown>) => void;
    start: (id: string) => void;
    stop: (id: string) => void;
    list: () => { id: string; name: string; status: string }[];
    enqueue: (name: string, body: string) => void;
    emitEvent: (name: string, body: string) => void;
  };
  $queue: { enqueue: (name: string, body: string) => void };
  $pubsub: { emit: (name: string, body: string) => void };
  signal: AbortSignal;
  Math: typeof Math;
  Date: typeof Date;
  JSON: typeof JSON;
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  parseInt: typeof parseInt;
  parseFloat: typeof parseFloat;
  isNaN: typeof isNaN;
  isFinite: typeof isFinite;
  encodeURI: typeof encodeURI;
  decodeURI: typeof decodeURI;
  btoa: (data: string) => string;
  atob: (data: string) => string;
  ErrorConstructor: typeof Error;
}

export function maskValue(val: unknown, secrets: Set<string>): unknown {
  if (typeof val === 'string') {
    let result = val;
    for (const secret of secrets) {
      if (secret.length > 0) {
        while (result.includes(secret)) {
          result = result.replace(secret, '\u2022'.repeat(6));
        }
      }
    }
    return result;
  }
  if (Array.isArray(val)) return val.map(v => maskValue(v, secrets));
  if (val !== null && typeof val === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      masked[k] = maskValue(v, secrets);
    }
    return masked;
  }
  return val;
}

function maskArgs(args: unknown[], secrets: Set<string>): unknown[] {
  if (secrets.size === 0) return args;
  return args.map(a => maskValue(a, secrets));
}

let timerIds: Set<number> | null = null;

export function getTimerIds(): Set<number> {
  if (!timerIds) timerIds = new Set();
  return timerIds;
}

export function clearTimerIds(): void {
  if (timerIds) {
    for (const id of timerIds) globalThis.clearTimeout(id);
    timerIds.clear();
  }
}

export function createServerSandboxGlobals(
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  props: Record<string, unknown>,
  cellsApi: ServerSandboxGlobals['$cells'],
  signal: AbortSignal,
  onLog: (entry: LogEntry) => void
): ServerSandboxGlobals {
  const ids = getTimerIds();

  const consoleProxy = new Proxy({} as ServerSandboxGlobals['console'], {
    get(_target, prop) {
      return (...args: unknown[]) => {
        const type = prop === 'warn' ? 'warn' :
          prop === 'error' ? 'error' :
          prop === 'info' ? 'info' :
          prop === 'table' ? 'table' : 'log';
        onLog({ timestamp: Date.now(), type, args: maskArgs(args, secrets) });
      };
    },
  });

  return {
    fetch: globalThis.fetch.bind(globalThis),
    setTimeout: (fn, ms, ...args) => {
      const id = globalThis.setTimeout(() => {
        ids.delete(id);
        (fn as () => void)();
      }, ms, ...args);
      ids.add(id);
      return id;
    },
    clearTimeout: (id) => {
      if (id !== undefined) ids.delete(id);
      globalThis.clearTimeout(id);
    },
    console: consoleProxy,
    $state: cellState,
    $env: { ...env },
    $secrets: { ...secretsObj },
    $props: { ...props },
    $cells: cellsApi,
    $queue: { enqueue: (name, body) => cellsApi.enqueue(name, body) },
    $pubsub: { emit: (name, body) => cellsApi.emitEvent(name, body) },
    signal,
    Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise,
    parseInt, parseFloat, isNaN, isFinite, encodeURI, decodeURI,
    btoa: (data: string) => Buffer.from(data).toString('base64'),
    atob: (data: string) => Buffer.from(data, 'base64').toString(),
    ErrorConstructor: Error,
  };
}
