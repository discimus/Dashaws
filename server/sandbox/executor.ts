import type { LogEntry } from '../../src/types/cell.js';
import type { ExecutionResult, CellsAPI, SandboxGlobals } from '../../src/shared/types.js';
import type { ExecutorConfig } from '../../src/shared/executor-core.js';
import { executeScript as coreExecuteScript } from '../../src/shared/executor-core.js';
import { createServerSandboxGlobals, clearTimerIds } from './globals.js';
import { maskState } from '../../src/shared/mask.js';

export type { ExecutionResult, CellsAPI } from '../../src/shared/types.js';

const BLOCKED_GLOBALS: Record<string, unknown> = {
  globalThis: undefined,
  global: undefined,
  window: undefined,
  self: undefined,
  document: undefined,
  localStorage: undefined,
  sessionStorage: undefined,
  require: undefined,
  module: undefined,
  exports: undefined,
  __dirname: undefined,
  __filename: undefined,
  process: undefined,
  Function: undefined,
};

const serverConfig: ExecutorConfig = {
  blockedGlobals: BLOCKED_GLOBALS,
  createGlobals(
    cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
  ): SandboxGlobals {
    return createServerSandboxGlobals(
      cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
    );
  },
  maskState,
  onFinally: clearTimerIds,
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
  return coreExecuteScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal, serverConfig);
}
