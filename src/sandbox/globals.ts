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
  $secrets: Record<string, string>;
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

  if (Array.isArray(val)) {
    return val.map(v => maskValue(v, secrets));
  }

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

export function maskState(
  state: Record<string, unknown>,
  secrets: Set<string>
): Record<string, unknown> {
  if (secrets.size === 0) return state;
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    masked[k] = maskValue(v, secrets);
  }
  return masked;
}

function stripConstructors(): {
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  ErrorConstructor: typeof Error;
  Date: typeof Date;
} {
  const ctors = [Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, Error, Date];
  const def = (ctor: unknown) => {
    Object.defineProperty(ctor, 'constructor', {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  };
  ctors.forEach(def);
  return { Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise, ErrorConstructor: Error, Date };
}

export function createSandboxGlobals(
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  signal: AbortSignal,
  onLog: (entry: LogEntry) => void
): { globals: SandboxGlobals; timerIds: Set<number> } {
  const timerIds = new Set<number>();

  const consoleProxy = new Proxy({} as SandboxGlobals['console'], {
    get(_target, prop) {
      return (...args: unknown[]) => {
        const type = prop === 'warn' ? 'warn'
          : prop === 'error' ? 'error'
          : prop === 'info' ? 'info'
          : prop === 'table' ? 'table'
          : 'log';
        onLog({ timestamp: Date.now(), type, args: maskArgs(args, secrets) });
      };
    },
  });

  const stripped = stripConstructors();

  return {
    timerIds,
    globals: {
      fetch: globalThis.fetch.bind(globalThis),
      setTimeout: (fn, ms, ...args) => {
        const id = globalThis.setTimeout(() => {
          timerIds.delete(id);
          (fn as () => void)();
        }, ms, ...args);
        timerIds.add(id);
        return id;
      },
      clearTimeout: (id) => {
        if (id !== undefined) timerIds.delete(id);
        globalThis.clearTimeout(id);
      },
      console: consoleProxy,
      $state: cellState,
      $env: { ...env },
      $secrets: { ...secretsObj },
      signal,
      Math,
      Date: stripped.Date,
      JSON,
      Array: stripped.Array,
      Object: stripped.Object,
      String: stripped.String,
      Number: stripped.Number,
      Boolean: stripped.Boolean,
      RegExp: stripped.RegExp,
      Map: stripped.Map,
      Set: stripped.Set,
      Promise: stripped.Promise,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURI,
      decodeURI,
      btoa,
      atob,
      ErrorConstructor: stripped.ErrorConstructor,
    },
  };
}
