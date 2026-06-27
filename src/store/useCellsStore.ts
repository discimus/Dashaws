import { create } from 'zustand';
import type { Cell } from '../types/cell';
import { LocalStorageBackend } from './storage';
import { generateId } from '../utils/id';
import { Scheduler } from '../sandbox/scheduler';
import { executeScript } from '../sandbox/executor';
import type { ExecutionResult } from '../sandbox/executor';

const storage = new LocalStorageBackend();
const ENV_STORAGE_KEY = 'script-dashboard-env';

let scheduler: Scheduler | null = null;

function loadEnv(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ENV_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEnv(env: Record<string, string>): void {
  localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(env));
}

interface CellsState {
  cells: Cell[];
  loaded: boolean;
  runningIds: string[];
  env: Record<string, string>;

  init: () => Promise<void>;
  addCell: () => Promise<void>;
  updateCell: (id: string, updates: Partial<Cell>) => Promise<void>;
  deleteCell: (id: string) => Promise<void>;
  startCell: (id: string) => void;
  stopCell: (id: string) => void;
  startAll: () => void;
  stopAll: () => void;
  runOnce: (id: string) => void;
  clearOutput: (id: string) => void;
  setEnvVar: (key: string, value: string) => void;
  deleteEnvVar: (key: string) => void;
}

export const useCellsStore = create<CellsState>()((set, get) => ({
  cells: [],
  loaded: false,
  runningIds: [],
  env: {},

  init: async () => {
    const cells = await storage.list();
    const env = loadEnv();

    scheduler = new Scheduler(
      (id) => get().cells.find(c => c.id === id),
      (id, result: ExecutionResult) => {
        set(state => ({
          cells: state.cells.map(c =>
            c.id === id
              ? {
                  ...c,
                  status: result.success ? 'success' : 'error',
                  lastRunAt: Date.now(),
                  output: [...c.output, ...result.output].slice(-200),
                  state: result.state,
                  updatedAt: Date.now(),
                }
              : c
          ),
        }));
        storage.save(get().cells.find(c => c.id === id)!);
      },
      () => get().env
    );

    const running = cells.filter(c => c.enabled);
    running.forEach(c => scheduler?.start(c.id));

    set({
      cells,
      loaded: true,
      env,
      runningIds: running.map(c => c.id),
    });
  },

  addCell: async () => {
    const now = Date.now();
    const cell: Cell = {
      id: generateId(),
      name: `Cell ${get().cells.length + 1}`,
      script: `// Write your script here\n// Available globals: fetch, console, $state, $env, setTimeout, clearTimeout, signal\n\nconsole.log("Hello from the cell!");\n\n// Example:\n// const res = await fetch($env.API_URL || "https://api.github.com/zen");\n// const text = await res.text();\n// console.log(text);\n// $state.lastResult = text;\n`,
      intervalMs: 10000,
      enabled: false,
      lastRunAt: null,
      status: 'idle',
      output: [],
      state: {},
      createdAt: now,
      updatedAt: now,
    };
    await storage.save(cell);
    set(state => ({ cells: [...state.cells, cell] }));
  },

  updateCell: async (id, updates) => {
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      ),
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      await storage.save(cell);

      if (updates.intervalMs !== undefined && scheduler?.isRunning(id)) {
        scheduler.restart(id);
      }
    }
  },

  deleteCell: async (id) => {
    scheduler?.stop(id);
    set(state => ({
      cells: state.cells.filter(c => c.id !== id),
      runningIds: state.runningIds.filter(rid => rid !== id),
    }));
    await storage.delete(id);
  },

  startCell: (id) => {
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, enabled: true, status: 'running' as const, updatedAt: Date.now() } : c
      ),
      runningIds: state.runningIds.includes(id) ? state.runningIds : [...state.runningIds, id],
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      storage.save(cell);
      scheduler?.start(id);
    }
  },

  stopCell: (id) => {
    scheduler?.stop(id);
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, enabled: false, updatedAt: Date.now() } : c
      ),
      runningIds: state.runningIds.filter(rid => rid !== id),
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      storage.save(cell);
    }
  },

  startAll: () => {
    set(state => {
      const updated = state.cells.map(c =>
        c.enabled ? c : { ...c, enabled: true, status: 'running' as const, updatedAt: Date.now() }
      );
      return {
        cells: updated,
        runningIds: updated.map(c => c.id),
      };
    });
    for (const cell of get().cells) {
      storage.save({ ...cell, enabled: true });
      scheduler?.start(cell.id);
    }
  },

  stopAll: () => {
    scheduler?.stopAll();
    set(state => ({
      cells: state.cells.map(c =>
        c.enabled ? { ...c, enabled: false, updatedAt: Date.now() } : c
      ),
      runningIds: [],
    }));
    for (const cell of get().cells) {
      storage.save({ ...cell, enabled: false });
    }
  },

  runOnce: (id) => {
    const cell = get().cells.find(c => c.id === id);
    if (!cell) return;

    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, status: 'running' as const } : c
      ),
    }));

    const ac = new AbortController();
    executeScript(cell.script, { ...cell.state }, { ...get().env }, ac.signal).then(result => {
      set(state => ({
        cells: state.cells.map(c =>
          c.id === id
            ? {
                ...c,
                status: result.success ? 'success' : 'error',
                lastRunAt: Date.now(),
                output: [...c.output, ...result.output].slice(-200),
                state: result.state,
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
      const updated = get().cells.find(c => c.id === id);
      if (updated) storage.save(updated);
    });
  },

  clearOutput: (id) => {
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, output: [], updatedAt: Date.now() } : c
      ),
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      storage.save(cell);
    }
  },

  setEnvVar: (key, value) => {
    set(state => {
      const env = { ...state.env, [key]: value };
      saveEnv(env);
      return { env };
    });
  },

  deleteEnvVar: (key) => {
    set(state => {
      const { [key]: _, ...env } = state.env;
      saveEnv(env);
      return { env };
    });
  },
}));
