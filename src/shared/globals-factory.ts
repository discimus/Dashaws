import type { LogEntry } from '../types/cell.js';
import type { SandboxGlobals } from './types.js';
import { maskArgs } from './mask.js';

export function createConsoleProxy(
  secrets: Set<string>,
  onLog: (entry: LogEntry) => void
): SandboxGlobals['console'] {
  return new Proxy({} as SandboxGlobals['console'], {
    get(_target, prop) {
      return (...args: unknown[]) => {
        const type = prop === 'warn' ? 'warn'
          : prop === 'error' ? 'error'
          : prop === 'info' ? 'info'
          : prop === 'table' ? 'table'
          : 'log';
        onLog({ timestamp: Date.now(), type, args: maskArgs(args, secrets) });
      };
    },
  });
}

export function createTrackedSetTimeout(
  timerIds: Set<number>
): SandboxGlobals['setTimeout'] {
  return (fn, ms, ...args) => {
    const id = globalThis.setTimeout(() => {
      timerIds.delete(id);
      (fn as () => void)();
    }, ms, ...args);
    timerIds.add(id);
    return id;
  };
}

export function createTrackedClearTimeout(
  timerIds: Set<number>
): SandboxGlobals['clearTimeout'] {
  return (id) => {
    if (id !== undefined) timerIds.delete(id);
    globalThis.clearTimeout(id);
  };
}
