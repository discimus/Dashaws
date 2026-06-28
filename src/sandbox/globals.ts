import type { LogEntry } from '../types/cell';
import type { CellsAPI, SandboxGlobals } from '../shared/types';
import { createConsoleProxy, createTrackedSetTimeout, createTrackedClearTimeout } from '../shared/globals-factory';
import { stripConstructors } from '../shared/strip-constructors';
import { createLoadPackage } from '../shared/load-package';

let currentTimerIds: Set<number> | null = null;

export function cleanupBrowserTimers(): void {
  if (currentTimerIds) {
    for (const id of currentTimerIds) globalThis.clearTimeout(id);
    currentTimerIds.clear();
    currentTimerIds = null;
  }
}

export function createSandboxGlobals(
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal,
  onLog: (entry: LogEntry) => void
): SandboxGlobals {
  currentTimerIds = new Set<number>();
  const timerIds = currentTimerIds;
  const consoleProxy = createConsoleProxy(secrets, onLog);
  const stripped = stripConstructors();

  return {
    fetch: globalThis.fetch.bind(globalThis),
    setTimeout: createTrackedSetTimeout(timerIds),
    clearTimeout: createTrackedClearTimeout(timerIds),
    console: consoleProxy,
    $state: cellState,
    $env: { ...env },
    $secrets: { ...secretsObj },
    $props: { ...props },
    $cells: cellsApi,
    $queue: { enqueue: (name, body) => cellsApi.enqueue(name, body) },
    $pubsub: { emit: (name, body) => cellsApi.emitEvent(name, body) },
    loadPackage: createLoadPackage(),
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
    btoa: globalThis.btoa.bind(globalThis),
    atob: globalThis.atob.bind(globalThis),
    ErrorConstructor: stripped.ErrorConstructor,
  };
}
