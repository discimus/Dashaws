import type { LogEntry } from '../types/cell';
import { createSandboxGlobals, maskState } from './globals';

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

const BLOCKED_GLOBALS: Record<string, unknown> = {
  window: undefined,
  self: undefined,
  globalThis: undefined,
  frames: undefined,
  parent: undefined,
  top: undefined,
  document: undefined,
  localStorage: undefined,
  sessionStorage: undefined,
  Function: undefined,
  XMLHttpRequest: undefined,
  WebSocket: undefined,
  EventSource: undefined,
  location: undefined,
  indexedDB: undefined,
};

export async function executeScript(
  script: string,
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal
): Promise<ExecutionResult> {
  const output: LogEntry[] = [];
  const onLog = (entry: LogEntry) => output.push(entry);

  const { globals, timerIds } = createSandboxGlobals(
    cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
  );

  const blockedNames = Object.keys(BLOCKED_GLOBALS);
  const blockedValues = Object.values(BLOCKED_GLOBALS);

  const entries = Object.entries(globals) as [string, unknown][];
  const globalNames = entries.map(([name]) => name);
  const globalValues = entries.map(([, value]) => value);

  const allNames = [...blockedNames, ...globalNames];
  const allValues = [...blockedValues, ...globalValues];

  const wrappedScript = `
    "use strict";
    return (async () => {
      ${script}
    })();
  `;

  try {
    const fn = new Function(...allNames, wrappedScript);
    await fn(...allValues);

    return {
      success: true,
      output,
      state: maskState(cellState, secrets),
    };
  } catch (err) {
    if (signal.aborted) {
      output.push({
        timestamp: Date.now(),
        type: 'warn',
        args: ['Execution aborted'],
      });
      return {
        success: true,
        output,
        state: maskState(cellState, secrets),
      };
    }

    const errorMessage = err instanceof Error
      ? `${err.name}: ${err.message}`
      : String(err);

    output.push({
      timestamp: Date.now(),
      type: 'error',
      args: [errorMessage],
    });

    return {
      success: false,
      error: errorMessage,
      output,
      state: maskState(cellState, secrets),
    };
  } finally {
    for (const id of timerIds) {
      globalThis.clearTimeout(id);
    }
    timerIds.clear();
  }
}
