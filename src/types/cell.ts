export interface LogEntry {
  timestamp: number;
  type: 'log' | 'warn' | 'error' | 'info' | 'table';
  args: unknown[];
}

export type CellStatus = 'idle' | 'running' | 'success' | 'error';

export interface Cell {
  id: string;
  name: string;
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
}

export interface StorageBackend {
  list(): Promise<Cell[]>;
  get(id: string): Promise<Cell | null>;
  save(cell: Cell): Promise<void>;
  delete(id: string): Promise<void>;
}
