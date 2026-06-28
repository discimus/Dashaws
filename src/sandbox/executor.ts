import type { CellsAPI, ExecutionResult, SandboxGlobals } from '../shared/types';
import type { ExecutorConfig } from '../shared/executor-core';
import { executeScript as coreExecuteScript } from '../shared/executor-core';
import { createSandboxGlobals, cleanupBrowserTimers } from './globals';
import { maskState } from '../shared/mask';
import { BROWSER_BLOCKED_GLOBALS } from '../shared/blocked-globals';

export type { ExecutionResult, CellsAPI } from '../shared/types';

const browserConfig: ExecutorConfig = {
  blockedGlobals: BROWSER_BLOCKED_GLOBALS,
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
