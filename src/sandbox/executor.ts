import type { CellsAPI, ExecutionResult, SandboxGlobals } from '../shared/types';
import type { ExecutorConfig } from '../shared/executor-core';
import { executeScript as coreExecuteScript } from '../shared/executor-core';
import { createSandboxGlobals, cleanupBrowserTimers } from './globals';
import { maskState } from '../shared/mask';

export type { ExecutionResult, CellsAPI } from '../shared/types';

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

const browserConfig: ExecutorConfig = {
  blockedGlobals: BLOCKED_GLOBALS,
  createGlobals(
    cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
  ): SandboxGlobals {
    return createSandboxGlobals(
      cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
    );
  },
  maskState,
  onFinally: cleanupBrowserTimers,
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
  return coreExecuteScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal, browserConfig);
}
