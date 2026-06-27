import type { Cell } from '../types/cell';
import type { ExecutionResult } from './executor';
import { executeScript } from './executor';

type GetCell = (id: string) => Cell | undefined;
type GetEnv = () => Record<string, string>;
type OnResult = (id: string, result: ExecutionResult) => void;

export class Scheduler {
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private controllers = new Map<string, AbortController>();
  private getEnv: GetEnv;
  private getCell: GetCell;
  private onResult: OnResult;

  constructor(getCell: GetCell, onResult: OnResult, getEnv: GetEnv) {
    this.getCell = getCell;
    this.onResult = onResult;
    this.getEnv = getEnv;
  }

  start(cellId: string): void {
    this.stop(cellId);

    const run = async () => {
      const cell = this.getCell(cellId);
      if (!cell) return;

      const ac = new AbortController();
      this.controllers.set(cellId, ac);

      try {
        const result = await executeScript(
          cell.script,
          { ...cell.state },
          this.getEnv(),
          ac.signal
        );
        this.onResult(cellId, result);
      } catch {
        // Errors are already captured inside executeScript
      }
    };

    run();

    const cell = this.getCell(cellId);
    if (cell) {
      const id = setInterval(run, cell.intervalMs);
      this.intervals.set(cellId, id);
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
