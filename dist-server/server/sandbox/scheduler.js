import { BaseScheduler } from '../../src/shared/scheduler-base.js';
import { parseMessageBody } from '../../src/shared/parse.js';
import { cronMatches } from '../../src/utils/cron.js';
import { maskState } from '../../src/shared/mask.js';
import { createServerSandboxGlobals, clearTimerIds } from './globals.js';
const BLOCKED_GLOBALS = {
    globalThis: undefined,
    global: undefined,
    window: undefined,
    self: undefined,
    document: undefined,
    localStorage: undefined,
    sessionStorage: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    __dirname: undefined,
    __filename: undefined,
    process: undefined,
    Function: undefined,
};
const SERVER_CONFIG = {
    blockedGlobals: BLOCKED_GLOBALS,
    createGlobals: createServerSandboxGlobals,
    maskState,
    onFinally: clearTimerIds,
};
export class ServerScheduler extends BaseScheduler {
    getCell;
    onResult;
    getEnvFn;
    getData;
    onEmit;
    cronInterval = null;
    constructor(getCell, onResult, getEnv, getData, onEmit) {
        super();
        this.getCell = getCell;
        this.onResult = onResult;
        this.getEnvFn = getEnv;
        this.getData = getData;
        this.onEmit = onEmit;
    }
    getEnv() {
        return this.getEnvFn();
    }
    get executorConfig() {
        return SERVER_CONFIG;
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