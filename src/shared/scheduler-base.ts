import type { Cell } from '../types/cell.js';
import type { ExecutionResult, CellsAPI } from './types.js';
import { executeScript, type ExecutorConfig } from './executor-core.js';
import { parseParams } from './parse.js';

export type GetCell = (id: string) => Cell | undefined;

export interface GetEnv {
  env: Record<string, string>;
  secrets: Set<string>;
  secretsObj: Record<string, string>;
}

export type OnResult = (id: string, result: ExecutionResult) => void;

export abstract class BaseScheduler {
  protected intervals = new Map<string, ReturnType<typeof setInterval>>();
  protected controllers = new Map<string, AbortController>();

  protected abstract getCell: GetCell;
  protected abstract getEnv(): GetEnv;
  protected abstract onResult: OnResult;
  protected abstract executorConfig: ExecutorConfig;

  protected abstract buildCellsAPI(): CellsAPI;

  async runOnce(cellId: string, props?: Record<string, unknown>): Promise<ExecutionResult | null> {
    const cell = this.getCell(cellId);
    if (!cell) return null;

    const ac = new AbortController();
    const { env, secrets, secretsObj } = this.getEnv();
    const resolvedProps = props ?? parseParams(cell.params);

    const result = await executeScript(
      cell.script,
      { ...cell.state },
      env,
      secrets,
      secretsObj,
      resolvedProps,
      this.buildCellsAPI(),
      ac.signal,
      this.executorConfig
    );

    this.onResult(cellId, result);
    return result;
  }

  start(cellId: string): void {
    this.stop(cellId);

    const run = async () => {
      const cell = this.getCell(cellId);
      if (!cell) return;

      const ac = new AbortController();
      this.controllers.set(cellId, ac);

      try {
        const { env, secrets, secretsObj } = this.getEnv();
        const props = parseParams(cell.params);
        const result = await executeScript(
          cell.script,
          { ...cell.state },
          env,
          secrets,
          secretsObj,
          props,
          this.buildCellsAPI(),
          ac.signal,
          this.executorConfig
        );
        this.onResult(cellId, result);
      } catch {
        /* errors captured inside executeScript */
      }
    };

    run();

    const cell = this.getCell(cellId);
    if (cell) {
      this.intervals.set(cellId, setInterval(run, cell.intervalMs));
    }
  }

  stop(cellId: string): void {
    const ac = this.controllers.get(cellId);
    ac?.abort();
    this.controllers.delete(cellId);

    const id = this.intervals.get(cellId);
    if (id !== undefined) {
      clearInterval(id);
      this.intervals.delete(cellId);
    }
  }

  stopAll(): void {
    for (const id of Array.from(this.intervals.keys())) {
      this.stop(id);
    }
  }

  restart(cellId: string): void {
    const cell = this.getCell(cellId);
    this.stop(cellId);
    if (cell?.enabled) {
      this.start(cellId);
    }
  }

  isRunning(cellId: string): boolean {
    return this.intervals.has(cellId);
  }

  getRunningIds(): string[] {
    return Array.from(this.intervals.keys());
  }
}
