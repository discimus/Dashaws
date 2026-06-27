import type { LogEntry } from '../types/cell';

export interface SandboxGlobals {
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
  btoa: typeof btoa;
  atob: typeof atob;
  ErrorConstructor: typeof Error;
}

export function createSandboxGlobals(
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  signal: AbortSignal,
  onLog: (entry: LogEntry) => void
): SandboxGlobals {
  const consoleProxy = new Proxy({} as SandboxGlobals['console'], {
    get(_target, prop) {
      return (...args: unknown[]) => {
        const type = prop === 'warn' ? 'warn'
          : prop === 'error' ? 'error'
          : prop === 'info' ? 'info'
          : prop === 'table' ? 'table'
          : 'log';
        onLog({ timestamp: Date.now(), type, args });
      };
    },
  });

  return {
    fetch: globalThis.fetch.bind(globalThis),
    setTimeout: (fn, ms, ...args) => {
      const id = globalThis.setTimeout(fn as () => void, ms, ...args);
      return id;
    },
    clearTimeout: (id) => globalThis.clearTimeout(id),
    console: consoleProxy,
    $state: cellState,
    $env: { ...env },
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
    btoa,
    atob,
    ErrorConstructor: Error,
  };
}
