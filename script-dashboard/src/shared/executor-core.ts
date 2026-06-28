import type { LogEntry } from '../types/cell.js';
import type { ExecutionResult, CellsAPI, SandboxGlobals } from './types.js';
import { maskState } from './mask.js';

export interface ExecutorConfig {
  blockedGlobals: Record<string, unknown>;
  createGlobals(
    cellState: Record<string, unknown>,
    env: Record<string, string>,
    secrets: Set<string>,
    secretsObj: Record<string, string>,
    props: Record<string, unknown>,
    cellsApi: CellsAPI,
    signal: AbortSignal,
    onLog: (entry: LogEntry) => void
  ): SandboxGlobals;
  maskState?: (state: Record<string, unknown>, secrets: Set<string>) => Record<string, unknown>;
  onFinally?: () => void;
}

export async function executeScript(
  script: string,
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal,
  config: ExecutorConfig
): Promise<ExecutionResult> {
  const output: LogEntry[] = [];
  const onLog = (entry: LogEntry) => output.push(entry);

  const globals = config.createGlobals(
    cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog
  );

  const blockedNames = Object.keys(config.blockedGlobals);
  const blockedValues = Object.values(config.blockedGlobals);

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

  const applyMask = config.maskState ?? maskState;

  try {
    const fn = new Function(...allNames, wrappedScript);
    await fn(...allValues);
    return { success: true, output, state: applyMask(cellState, secrets) };
  } catch (err) {
    if (signal.aborted) {
      output.push({ timestamp: Date.now(), type: 'warn', args: ['Execution aborted'] });
      return { success: true, output, state: applyMask(cellState, secrets) };
    }

    const errorMessage = err instanceof Error
      ? `${err.name}: ${err.message}`
      : String(err);

    output.push({ timestamp: Date.now(), type: 'error', args: [errorMessage] });

    return { success: false, error: errorMessage, output, state: applyMask(cellState, secrets) };
  } finally {
    config.onFinally?.();
  }
}
