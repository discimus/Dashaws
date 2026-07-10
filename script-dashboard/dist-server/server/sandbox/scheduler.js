import { BaseScheduler } from '../../src/shared/scheduler-base.js';
import { parseMessageBody } from '../../src/shared/parse.js';
const randomUUID = () => {
    if (typeof crypto.randomUUID !== 'function')
        return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
};
import { cronMatches } from '../../src/utils/cron.js';
import { maskState } from '../../src/shared/mask.js';
import { createServerSandboxGlobals, cleanupServerTimers } from './globals.js';
import { SERVER_BLOCKED_GLOBALS } from '../../src/shared/blocked-globals.js';
const SERVER_CONFIG = {
    blockedGlobals: SERVER_BLOCKED_GLOBALS,
    createGlobals: createServerSandboxGlobals,
    maskState,
    onFinally: cleanupServerTimers,
};
export class ServerScheduler extends BaseScheduler {
    getCell;
    onResult;
    getEnvFn;
    getData;
    onEmit;
    cronInterval = null;
    queueInterval = null;
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
        this.queueInterval = setInterval(() => {
            const { queues } = this.getData();
            for (const q of Object.values(queues)) {
                if (q.messages.length === 0)
                    continue;
                for (const subId of q.subscriberIds) {
                    const cell = this.getCell(subId);
                    if (!cell)
                        continue;
                    const msg = q.messages[0];
                    void this.runOnce(subId, parseMessageBody(msg.body)).then(() => {
                        q.messages = q.messages.slice(1);
                    }).catch(() => {
                        msg.retries += 1;
                        const maxRetries = q.maxRetries ?? 3;
                        if (msg.retries >= maxRetries) {
                            q.messages = q.messages.slice(1);
                        }
                    });
                    break;
                }
            }
        }, 2000);
    }
    stopQueuePolling() {
        if (this.queueInterval) {
            clearInterval(this.queueInterval);
            this.queueInterval = null;
        }
    }
    startCronPolling() {
        this.cronInterval = setInterval(() => {
            const { crons } = this.getData();
            const now = Date.now();
            const currentMinute = Math.floor(now / 60000);
            for (const cron of crons) {
                if (!cron.enabled)
                    continue;
                if (cron.lastRunAt) {
                    const lastMinute = Math.floor(cron.lastRunAt / 60000);
                    if (lastMinute >= currentMinute)
                        continue;
                }
                if (!cronMatches(cron.expression, new Date(now)))
                    continue;
                this.dispatchCron(cron);
                cron.lastRunAt = now;
            }
        }, 15000);
    }
    stopCronPolling() {
        if (this.cronInterval) {
            clearInterval(this.cronInterval);
            this.cronInterval = null;
        }
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
                    const msg = { id: randomUUID(), body: cron.payload, timestamp: Date.now(), retries: 0 };
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
            enqueue: (name, body) => {
                const { queues } = this.getData();
                const queue = queues[name];
                if (queue) {
                    const msg = { id: randomUUID(), body, timestamp: Date.now(), retries: 0 };
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