import type { ExecutionResult, CellsAPI, SandboxGlobals } from '../../src/shared/types.js';
import type { ExecutorConfig } from '../../src/shared/executor-core.js';
import { executeScript as coreExecuteScript } from '../../src/shared/executor-core.js';
import { createServerSandboxGlobals, cleanupServerTimers } from './globals.js';
import { maskState } from '../../src/shared/mask.js';
import { SERVER_BLOCKED_GLOBALS } from '../../src/shared/blocked-globals.js';

export type { ExecutionResult, CellsAPI } from '../../src/shared/types.js';

const serverConfig: ExecutorConfig = {
  blockedGlobals: SERVER_BLOCKED_GLOBALS,
  createGlobals(
    cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
  ): SandboxGlobals {
    return createServerSandboxGlobals(
      cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
    );
  },
  maskState,
  onFinally: cleanupServerTimers,
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
