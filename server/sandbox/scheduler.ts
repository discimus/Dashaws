import type { Cell, QueueMessage, CronEntry, Queue, EventTopic } from '../../src/types/cell.js';
import type { ExecutionResult, CellsAPI } from '../../src/shared/types.js';
import type { ExecutorConfig } from '../../src/shared/executor-core.js';
import { BaseScheduler, type GetCell, type GetEnv, type OnResult } from '../../src/shared/scheduler-base.js';
import { parseMessageBody } from '../../src/shared/parse.js';
import { cronMatches } from '../../src/utils/cron.js';
import { maskState } from '../../src/shared/mask.js';
import { createServerSandboxGlobals, cleanupServerTimers } from './globals.js';
import { SERVER_BLOCKED_GLOBALS } from '../../src/shared/blocked-globals.js';

export type { GetCell, GetEnv, OnResult };

type GetData = () => {
  queues: Record<string, Queue>;
  eventTopics: Record<string, EventTopic>;
  crons: CronEntry[];
};

const SERVER_CONFIG: ExecutorConfig = {
  blockedGlobals: SERVER_BLOCKED_GLOBALS,
  createGlobals: createServerSandboxGlobals as ExecutorConfig['createGlobals'],
  maskState,
  onFinally: cleanupServerTimers,
};

export class ServerScheduler extends BaseScheduler {
  protected override getCell: GetCell;
  protected override onResult: OnResult;
  private getEnvFn: () => GetEnv;
  private getData: GetData;
  private onEmit: (name: string, body: string) => void;
  private cronInterval: ReturnType<typeof setInterval> | null = null;
  private queueInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    getCell: GetCell,
    onResult: OnResult,
    getEnv: () => GetEnv,
    getData: GetData,
    onEmit: (name: string, body: string) => void
  ) {
    super();
    this.getCell = getCell;
    this.onResult = onResult;
    this.getEnvFn = getEnv;
    this.getData = getData;
    this.onEmit = onEmit;
  }

  protected override getEnv(): GetEnv {
    return this.getEnvFn();
  }

  protected override get executorConfig(): ExecutorConfig {
    return SERVER_CONFIG;
  }

  startQueuePolling(): void {
    this.queueInterval = setInterval(() => {
      const { queues } = this.getData();
      for (const q of Object.values(queues)) {
        if (q.messages.length === 0) continue;
        for (const subId of q.subscriberIds) {
          const cell = this.getCell(subId);
          if (!cell) continue;
          const msg = q.messages[0];
          q.messages = q.messages.slice(1);
          this.runOnce(subId, parseMessageBody(msg.body));
          break;
        }
      }
    }, 2000);
  }

  stopQueuePolling(): void {
    if (this.queueInterval) { clearInterval(this.queueInterval); this.queueInterval = null; }
  }

  startCronPolling(): void {
    this.cronInterval = setInterval(() => {
      const { crons } = this.getData();
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);
      for (const cron of crons) {
        if (!cron.enabled) continue;
        if (cron.lastRunAt) {
          const lastMinute = Math.floor(cron.lastRunAt / 60000);
          if (lastMinute >= currentMinute) continue;
        }
        if (!cronMatches(cron.expression, new Date(now))) continue;
        this.dispatchCron(cron);
        cron.lastRunAt = now;
      }
    }, 15000);
  }

  stopCronPolling(): void {
    if (this.cronInterval) { clearInterval(this.cronInterval); this.cronInterval = null; }
  }

  dispatchCron(cron: CronEntry): void {
    const props = parseMessageBody(cron.payload);
    switch (cron.target.type) {
      case 'cell': {
        const cell = this.getCell(cron.target.name);
        if (cell) this.runOnce(cell.id, props);
        break;
      }
      case 'pubsub':
        this.onEmit(cron.target.name, cron.payload);
        break;
      case 'queue': {
        const { queues } = this.getData();
        const queue = queues[cron.target.name];
        if (queue) {
          const msg: QueueMessage = { id: crypto.randomUUID(), body: cron.payload, timestamp: Date.now(), retries: 0 };
          queue.messages.push(msg);
        }
        break;
      }
    }
  }

  runCronNow(cron: CronEntry): void {
    this.dispatchCron(cron);
  }

  protected override buildCellsAPI(): CellsAPI {
    return {
      run: (id, props) => { this.runOnce(id, props); },
      start: (id) => {
        const cell = this.getCell(id);
        if (cell && !cell.enabled) { cell.enabled = true; this.start(id); }
      },
      stop: (id) => this.stop(id),
      list: () => {
        const result: { id: string; name: string; status: string }[] = [];
        for (const c of this.intervals.keys()) {
          const cell = this.getCell(c);
          if (cell) result.push({ id: cell.id, name: cell.name, status: 'running' });
        }
        return result;
      },
      enqueue: (name, body) => {
        const { queues } = this.getData();
        const queue = queues[name];
        if (queue) {
          const msg: QueueMessage = { id: crypto.randomUUID(), body, timestamp: Date.now(), retries: 0 };
          queue.messages.push(msg);
        }
      },
      emitEvent: (name, body) => {
        this.onEmit(name, body);
      },
    };
  }
}
