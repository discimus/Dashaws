import { executeScript } from './executor.js';
import { cronMatches } from '../../src/utils/cron.js';
function parseParams(params) {
    try {
        const p = JSON.parse(params || '{}');
        return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
    }
    catch {
        return {};
    }
}
function parseMessageBody(body) {
    try {
        const parsed = JSON.parse(body);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : { message: body };
    }
    catch {
        return { message: body };
    }
}
export class ServerScheduler {
    intervals = new Map();
    controllers = new Map();
    getEnv;
    getCell;
    onResult;
    getData;
    onEmit;
    cronInterval = null;
    constructor(getCell, onResult, getEnv, getData, onEmit) {
        this.getCell = getCell;
        this.onResult = onResult;
        this.getEnv = getEnv;
        this.getData = getData;
        this.onEmit = onEmit;
    }
    async runOnce(cellId, props) {
        const cell = this.getCell(cellId);
        if (!cell)
            return null;
        const ac = new AbortController();
        const { env, secrets, secretsObj } = this.getEnv();
        const resolvedProps = props ?? parseParams(cell.params);
        const result = await executeScript(cell.script, { ...cell.state }, env, secrets, secretsObj, resolvedProps, this.buildCellsAPI(), ac.signal);
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
                const result = await executeScript(cell.script, { ...cell.state }, env, secrets, secretsObj, props, this.buildCellsAPI(), ac.signal);
                this.onResult(cellId, result);
            }
            catch { /* errors captured inside */ }
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
        for (const id of Array.from(this.intervals.keys()))
            this.stop(id);
    }
    restart(cellId) {
        const cell = this.getCell(cellId);
        this.stop(cellId);
        if (cell?.enabled)
            this.start(cellId);
    }
    isRunning(cellId) {
        return this.intervals.has(cellId);
    }
    startQueuePolling() {
        setInterval(() => {
            const { queues } = this.getData();
            for (const q of Object.values(queues)) {
                if (q.messages.length === 0)
                    continue;
                for (const subId of q.subscriberIds) {
                    const cell = this.getCell(subId);
                    if (!cell)
                        continue;
                    const msg = q.messages[0];
                    q.messages = q.messages.slice(1);
                    this.runOnce(subId, parseMessageBody(msg.body));
                    break;
                }
            }
        }, 2000);
    }
    startCronPolling() {
        this.cronInterval = setInterval(() => {
            const { crons } = this.getData();
            const now = new Date();
            for (const cron of crons) {
                if (!cron.enabled)
                    continue;
                if (cron.lastRunAt && now.getTime() - cron.lastRunAt < 55000)
                    continue;
                if (!cronMatches(cron.expression, now))
                    continue;
                this.dispatchCron(cron);
            }
        }, 15000);
    }
    dispatchCron(cron) {
        const props = parseMessageBody(cron.payload);
        switch (cron.target.type) {
            case 'cell': {
                const cell = this.getCell(cron.target.name);
                if (cell)
                    this.runOnce(cell.id, props);
                break;
            }
            case 'pubsub':
                this.onEmit(cron.target.name, cron.payload);
                break;
            case 'queue': {
                const { queues } = this.getData();
                const queue = queues[cron.target.name];
                if (queue) {
                    const msg = { id: crypto.randomUUID(), body: cron.payload, timestamp: Date.now(), retries: 0 };
                    queue.messages.push(msg);
                }
                break;
            }
        }
    }
    runCronNow(cron) {
        this.dispatchCron(cron);
    }
    buildCellsAPI() {
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
                const result = [];
                for (const c of this.intervals.keys()) {
                    const cell = this.getCell(c);
                    if (cell)
                        result.push({ id: cell.id, name: cell.name, status: 'running' });
                }
                return result;
            },
            enqueue: (name, body) => {
                const { queues } = this.getData();
                const queue = queues[name];
                if (queue) {
                    const msg = { id: crypto.randomUUID(), body, timestamp: Date.now(), retries: 0 };
                    queue.messages.push(msg);
                }
            },
            emitEvent: (name, body) => {
                this.onEmit(name, body);
            },
        };
    }
}
//# sourceMappingURL=scheduler.js.map