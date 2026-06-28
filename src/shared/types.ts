import type { LogEntry } from '../types/cell.js';

export interface ExecutionResult {
  success: boolean;
  error?: string;
  output: LogEntry[];
  state: Record<string, unknown>;
}

export interface CellsAPI {
  run: (id: string, props?: Record<string, unknown>) => void;
  start: (id: string) => void;
  stop: (id: string) => void;
  list: () => { id: string; name: string; status: string }[];
  enqueue: (name: string, body: string) => void;
  emitEvent: (name: string, body: string) => void;
}

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
  $props: Record<string, unknown>;
  $cells: CellsAPI;
  $queue: { enqueue: (name: string, body: string) => void };
  $pubsub: { emit: (name: string, body: string) => void };
  loadPackage: (spec: string) => Promise<Record<string, unknown>>;
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
