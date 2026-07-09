import { executeScript } from './executor-core.js';
import { parseParams } from './parse.js';
export class BaseScheduler {
    intervals = new Map();
    controllers = new Map();
    async runOnce(cellId, props) {
        const cell = this.getCell(cellId);
        if (!cell)
            return null;
        const ac = new AbortController();
        const { env, secrets, secretsObj } = this.getEnv();
        const resolvedProps = props ?? parseParams(cell.params);
        const config = { ...this.executorConfig, timeoutMs: cell.timeoutMs ?? undefined };
        const result = await executeScript(cell.script, { ...cell.state }, env, secrets, secretsObj, resolvedProps, this.buildCellsAPI(), ac.signal, config);
        this.onResult(cellId, result);
        return result;
    }
    start(cellId) {
        this.stop(cellId);
        const run = async () => {
            const cell = this.getCell(cellId);
            if (!cell)
                return;
            const ac = new AbortController();
            this.controllers.set(cellId, ac);
            try {
                const { env, secrets, secretsObj } = this.getEnv();
                const props = parseParams(cell.params);
                const config = { ...this.executorConfig, timeoutMs: cell.timeoutMs ?? undefined };
                const result = await executeScript(cell.script, { ...cell.state }, env, secrets, secretsObj, props, this.buildCellsAPI(), ac.signal, config);
                this.onResult(cellId, result);
            }
            catch {
                /* errors captured inside executeScript */
            }
        };
        run();
        const cell = this.getCell(cellId);
        if (cell) {
            this.intervals.set(cellId, setInterval(run, cell.intervalMs));
        }
    }
    stop(cellId) {
        const ac = this.controllers.get(cellId);
        ac?.abort();
        this.controllers.delete(cellId);
        const id = this.intervals.get(cellId);
        if (id !== undefined) {
            clearInterval(id);
            this.intervals.delete(cellId);
        }
    }
    stopAll() {
        for (const id of Array.from(this.intervals.keys())) {
            this.stop(id);
        }
    }
    restart(cellId) {
        const cell = this.getCell(cellId);
        this.stop(cellId);
        if (cell?.enabled) {
            this.start(cellId);
        }
    }
    isRunning(cellId) {
        return this.intervals.has(cellId);
    }
    getRunningIds() {
        return Array.from(this.intervals.keys());
    }
}
//# sourceMappingURL=scheduler-base.js.map