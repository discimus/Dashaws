import type { CellsAPI } from '../shared/types';
import type { ExecutorConfig } from '../shared/executor-core';
import { BaseScheduler, type GetCell, type GetEnv, type OnResult } from '../shared/scheduler-base';
import { maskState } from '../shared/mask';
import { createSandboxGlobals, cleanupBrowserTimers } from './globals';
import { BROWSER_BLOCKED_GLOBALS } from '../shared/blocked-globals';

export type { GetCell, GetEnv, OnResult };

function createGlobalsWrapper(
  state: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal,
  onLog: (entry: import('../types/cell').LogEntry) => void
) {
  return createSandboxGlobals(state, env, secrets, secretsObj, props, cellsApi, signal, onLog);
}

const SCHEDULER_CONFIG: ExecutorConfig = {
  blockedGlobals: BROWSER_BLOCKED_GLOBALS,
  createGlobals: createGlobalsWrapper,
  maskState,
  onFinally: cleanupBrowserTimers,
};

export class Scheduler extends BaseScheduler {
  protected override getCell: GetCell;
  protected override onResult: OnResult;
  private getEnvFn: () => GetEnv;
  private onEnqueue: (name: string, body: string) => void;
  private onEmit: (name: string, body: string) => void;

  constructor(
    getCell: GetCell,
    onResult: OnResult,
    getEnv: () => GetEnv,
    onEnqueue: (name: string, body: string) => void,
    onEmit: (name: string, body: string) => void
  ) {
    super();
    this.getCell = getCell;
    this.onResult = onResult;
    this.getEnvFn = getEnv;
    this.onEnqueue = onEnqueue;
    this.onEmit = onEmit;
  }

  protected override getEnv(): GetEnv {
    return this.getEnvFn();
  }

  protected override get executorConfig(): ExecutorConfig {
    return SCHEDULER_CONFIG;
  }

  protected override buildCellsAPI(): CellsAPI {
    return {
      enqueue: (name, body) => this.onEnqueue(name, body),
      emitEvent: (name, body) => this.onEmit(name, body),
    };
  }
}
