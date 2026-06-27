import type { LogEntry } from '../types/cell';
import { createSandboxGlobals } from './globals';

export interface ExecutionResult {
  success: boolean;
  error?: string;
  output: LogEntry[];
  state: Record<string, unknown>;
}

export async function executeScript(
  script: string,
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  signal: AbortSignal
): Promise<ExecutionResult> {
  const output: LogEntry[] = [];
  const onLog = (entry: LogEntry) => output.push(entry);

  const globals = createSandboxGlobals(cellState, env, signal, onLog);
  const entries = Object.entries(globals) as [string, unknown][];
  const globalNames = entries.map(([name]) => name);
  const globalValues = entries.map(([, value]) => value);

  const wrappedScript = `
    "use strict";
    return (async () => {
      ${script}
    })();
  `;

  try {
    const fn = new Function(...globalNames, wrappedScript);
    await fn(...globalValues);

    return {
      success: true,
      output,
      state: { ...cellState },
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
        state: { ...cellState },
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
      state: { ...cellState },
    };
  }
}
