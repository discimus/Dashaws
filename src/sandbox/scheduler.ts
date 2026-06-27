import type { Cell } from '../types/cell';
import type { ExecutionResult, CellsAPI } from './executor';
import { executeScript } from './executor';

type GetCell = (id: string) => Cell | undefined;
type GetEnv = () => {
  env: Record<string, string>;
  secrets: Set<string>;
  secretsObj: Record<string, string>;
};
type OnResult = (id: string, result: ExecutionResult) => void;

function parseParams(params: string): Record<string, unknown> {
  try {
    const p = JSON.parse(params || '{}');
    return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

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
      ac.signal
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
        const props = parseParams(cell?.params ?? '');
        const result = await executeScript(
          cell.script,
          { ...cell.state },
          env,
          secrets,
          secretsObj,
          props,
          this.buildCellsAPI(),
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

  buildCellsAPI(): CellsAPI {
    return {
      run: (id, props) => { this.runOnce(id, props); },
      start: (id) => {
        const cell = this.getCell(id);
        if (cell && !cell.enabled) {
          cell.enabled = true;
          this.start(id);
        }
      },
      stop: (id) => this.stop(id),
      list: () => {
        const cells = [];
        for (const c of this.intervals.keys()) {
          const cell = this.getCell(c);
          if (cell) cells.push(cell);
        }
        return cells.map(c => ({
          id: c.id,
          name: c.name,
          status: this.intervals.has(c.id) ? 'running' : c.status,
        }));
      },
    };
  }
}
