import type { LogEntry } from '../../src/types/cell.js';
import type { CellsAPI, SandboxGlobals } from '../../src/shared/types.js';
import { createConsoleProxy, createTrackedSetTimeout, createTrackedClearTimeout } from '../../src/shared/globals-factory.js';

let timerIds: Set<number> | null = null;

function getTimerIds(): Set<number> {
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
  cellsApi: CellsAPI,
  signal: AbortSignal,
  onLog: (entry: LogEntry) => void
): SandboxGlobals {
  const ids = getTimerIds();
  const consoleProxy = createConsoleProxy(secrets, onLog);

  return {
    fetch: globalThis.fetch.bind(globalThis),
    setTimeout: createTrackedSetTimeout(ids),
    clearTimeout: createTrackedClearTimeout(ids),
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
