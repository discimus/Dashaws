export interface LogEntry {
  timestamp: number;
  type: 'log' | 'warn' | 'error' | 'info' | 'table';
  args: unknown[];
}

export type CellStatus = 'idle' | 'running' | 'success' | 'error';

export interface Cell {
  id: string;
  name: string;
  language: 'javascript' | 'python';
  script: string;
  intervalMs: number;
  enabled: boolean;
  lastRunAt: number | null;
  status: CellStatus;
  output: LogEntry[];
  state: Record<string, unknown>;
  params: string;
  createdAt: number;
  updatedAt: number;
  lockedBy?: string | null;
  lockedAt?: number | null;
}

export interface QueueMessage {
  id: string;
  body: string;
  timestamp: number;
  retries: number;
}

export interface Queue {
  name: string;
  maxRetries: number;
  subscriberIds: string[];
  messages: QueueMessage[];
}

export interface EventTopic {
  name: string;
  subscriberIds: string[];
}

export interface CronTarget {
  type: 'cell' | 'queue' | 'pubsub';
  name: string;
}

export interface CronEntry {
  name: string;
  expression: string;
  target: CronTarget;
  payload: string;
  enabled: boolean;
  lastRunAt: number | null;
}

export interface StorageBackend {
  list(): Promise<Cell[]>;
  get(id: string): Promise<Cell | null>;
  save(cell: Cell): Promise<void>;
  delete(id: string): Promise<void>;
}
