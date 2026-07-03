import { create } from 'zustand';
import type { Cell, Queue, EventTopic, QueueMessage, CronEntry } from '../types/cell';
import { LocalStorageBackend } from './storage';
import { ApiClient } from './api-client';
import { generateId } from '../utils/id';
import { cronMatches } from '../utils/cron';
import { Scheduler } from '../sandbox/scheduler';
import type { ExecutionResult } from '../sandbox/executor';
import { parseMessageBody } from '../shared/parse';
import {
  encryptSecrets,
  decryptSecrets,
  hashPassword,
  loadBlob,
  saveBlob,
  clearBlob,
  type EncryptedBlob,
} from '../crypto/secrets';

let apiClient: ApiClient | null = null;
let isServerMode = false;

const storage = new LocalStorageBackend();
const ENV_STORAGE_KEY = 'dashaws-env';

let scheduler: Scheduler | null = null;

let serverPollInterval: ReturnType<typeof setInterval> | null = null;

function startServerPolling() {
  if (serverPollInterval) return;
  serverPollInterval = setInterval(async () => {
    if (!apiClient) return;
    try {
      const remote = await apiClient.list();
      const remoteCrons = await apiClient.getCrons();
      useCellsStore.setState(state => {
        const merged = remote.map(r => {
          const local = state.cells.find(c => c.id === r.id);
          if (!local) return r;
          // If we hold the lock, keep our local script/name content
          if (r.lockedBy && r.lockedBy === state.clientId) {
            return { ...r, script: local.script, name: local.name, updatedAt: local.updatedAt };
          }
          // Server is source of truth for status, lastRunAt, output, state
          // But preserve local script/name if user is editing
          if (local.updatedAt > r.updatedAt) return local;
          return r;
        });
        // Add local-only cells (just added, not yet synced)  
        for (const c of state.cells) {
          if (!merged.find(m => m.id === c.id)) merged.push(c);
        }
        return { cells: merged, crons: remoteCrons };
      });
    } catch { /* ignore polling errors */ }
  }, 3000);
}

function stopServerPolling() {
  if (serverPollInterval) { clearInterval(serverPollInterval); serverPollInterval = null; }
}

// Export for cleanup (e.g., page unload)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', stopServerPolling);
}

function persistQueues(queues: Record<string, Queue>) {
  if (isServerMode && apiClient) apiClient.saveQueues(queues);
  else saveQueues(queues);
}

function persistTopics(topics: Record<string, EventTopic>) {
  if (isServerMode && apiClient) apiClient.saveTopics(topics);
  else saveTopics(topics);
}

function persistCrons(crons: CronEntry[]) {
  if (isServerMode && apiClient) apiClient.saveCrons(crons);
  else saveCrons(crons);
}

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

function secretsMaskSet(values: Record<string, string>): Set<string> {
  const s = new Set<string>();
  for (const v of Object.values(values)) {
    if (v) s.add(v);
  }
  return s;
}

let cachedSecretsPassword: string | null = null;
const UNLOCKED_KEY = 'dashaws-keep-unlocked';
const SESSION_PW_KEY = 'dashaws-session-pw';

function loadKeepUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveKeepUnlocked(v: boolean): void {
  localStorage.setItem(UNLOCKED_KEY, v ? '1' : '0');
}

function saveSessionPassword(pw: string): void {
  try {
    sessionStorage.setItem(SESSION_PW_KEY, pw);
  } catch { /* noop */ }
}

function loadSessionPassword(): string | null {
  try {
    return sessionStorage.getItem(SESSION_PW_KEY);
  } catch {
    return null;
  }
}

function clearSessionPassword(): void {
  try {
    sessionStorage.removeItem(SESSION_PW_KEY);
  } catch { /* noop */ }
}

const QUEUE_STORAGE_KEY = 'dashaws-queues';
const TOPIC_STORAGE_KEY = 'dashaws-topics';

function loadQueues(): Record<string, Queue> {
  try { return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveQueues(q: Record<string, Queue>) {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(q));
}

function loadTopics(): Record<string, EventTopic> {
  try { return JSON.parse(localStorage.getItem(TOPIC_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveTopics(t: Record<string, EventTopic>) {
  localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(t));
}

const CRON_STORAGE_KEY = 'dashaws-crons';

function loadCrons(): CronEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CRON_STORAGE_KEY) || '[]');
    return raw.map((c: Partial<CronEntry>) => ({
      ...c,
      enabled: c.enabled ?? true,
      lastRunAt: c.lastRunAt ?? null,
    }));
  } catch { return []; }
}

function saveCrons(c: CronEntry[]) {
  localStorage.setItem(CRON_STORAGE_KEY, JSON.stringify(c));
}

interface CellsState {
  cells: Cell[];
  loaded: boolean;
  runningIds: string[];
  env: Record<string, string>;
  secretsLocked: boolean;
  secrets: Record<string, string>;
  secretsBlob: EncryptedBlob | null;
  keepUnlocked: boolean;
  selectedIds: string[];
  queues: Record<string, Queue>;
  eventTopics: Record<string, EventTopic>;
  crons: CronEntry[];
  languages: string[];
  clientId: string;
  editingCellId: string | null;

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

  lockCell: (id: string) => Promise<boolean>;
  unlockCell: (id: string) => Promise<void>;

  tryUnlockSecrets: (password: string) => Promise<boolean>;
  lockSecrets: () => void;
  setSecret: (key: string, value: string) => Promise<void>;
  deleteSecret: (key: string) => Promise<void>;
  setSecretsPassword: (password: string) => Promise<void>;
  removeSecretsPassword: () => Promise<void>;
  toggleKeepUnlocked: () => void;
  toggleSelected: (id: string, ctrl: boolean) => void;
  clearSelection: () => void;
  startSelected: () => void;
  stopSelected: () => void;
  deleteSelected: () => void;
  keepAlive: boolean;
  toggleKeepAlive: () => void;

  addQueue: (name: string, maxRetries: number) => void;
  deleteQueue: (name: string) => void;
  enqueue: (name: string, body: string) => void;
  addQueueSubscriber: (queueName: string, cellId: string) => void;
  removeQueueSubscriber: (queueName: string, cellId: string) => void;
  addEventTopic: (name: string) => void;
  deleteEventTopic: (name: string) => void;
  emitEvent: (name: string, body: string) => void;
  addEventSubscriber: (topicName: string, cellId: string) => void;
  removeEventSubscriber: (topicName: string, cellId: string) => void;

  addCron: (entry: Omit<CronEntry, 'lastRunAt'>) => void;
  deleteCron: (name: string) => void;
  toggleCron: (name: string) => void;
  runCronNow: (name: string) => void;
  editCron: (name: string, updates: Partial<Omit<CronEntry, 'name'>>) => void;
}

export function cronTargetsSecrets(cron: CronEntry, cells: Cell[]): boolean {
  if (cron.target.type !== 'cell') return false;
  const cell = cells.find(c => c.id === cron.target.name || c.name === cron.target.name);
  if (!cell) return false;
  return /\$secrets[\.\[]\s*['"\w]/.test(cell.script);
}

export const useCellsStore = create<CellsState>()((set, get) => ({
  cells: [],
  loaded: false,
  runningIds: [],
  env: {},
  secretsLocked: false,
  secrets: {},
  secretsBlob: null,
  keepUnlocked: loadKeepUnlocked(),
  selectedIds: [],
  keepAlive: false,
  queues: {},
  eventTopics: {},
  crons: [],
  languages: ['javascript'],
  clientId: Math.random().toString(36).substring(2, 10),
  editingCellId: null,

  init: async () => {
    // Detect server mode
    apiClient = new ApiClient();
    try { isServerMode = await apiClient.health(); } catch { isServerMode = false; }
    if (!isServerMode) apiClient = null;

    let cells: Cell[];
    let env: Record<string, string>;
    let queues: Record<string, Queue>;
    let eventTopics: Record<string, EventTopic>;
    let crons: CronEntry[];
    let languages = ['javascript'];

    if (isServerMode && apiClient) {
      cells = await apiClient.list();
      env = await apiClient.getEnv();
      queues = await apiClient.getQueues();
      eventTopics = await apiClient.getTopics();
      crons = await apiClient.getCrons();
      languages = await apiClient.getLanguages();
      startServerPolling();
    } else {
      cells = await storage.list();
      env = loadEnv();
      queues = loadQueues();
      eventTopics = loadTopics();
      crons = loadCrons();

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
          const updated = get().cells.find(c => c.id === id);
          if (updated) storage.save(updated);
        },
        () => {
          const state = get();
          return {
            env: { ...state.env },
            secrets: secretsMaskSet(state.secrets),
            secretsObj: { ...state.secrets },
          };
        },
        (name, body) => get().enqueue(name, body),
        (name, body) => get().emitEvent(name, body)
      );

      const running = cells.filter(c => c.enabled);
      running.forEach(c => scheduler?.start(c.id));
    }

    const blob = loadBlob();

    let unlocked = false;
    let decrypted: Record<string, string> = {};

    // Try auto-unlock via sessionStorage if keepUnlocked is enabled
    if (blob && loadKeepUnlocked()) {
      const sessionPw = loadSessionPassword();
      if (sessionPw) {
        try {
          const currentHash = await hashPassword(sessionPw);
          if (currentHash === blob.hash) {
            decrypted = await decryptSecrets(blob, sessionPw);
            cachedSecretsPassword = sessionPw;
            unlocked = true;
          }
        } catch {
          clearSessionPassword();
        }
      }
    }

    // In server mode, sync unlock state to server
    if (isServerMode && apiClient) {
      try {
        const status = await apiClient.getSecretsStatus();
        if (unlocked) {
          if (!status.hasBlob) {
            await apiClient.putSecretsBlob(blob!);
          }
          if (!status.unlocked) {
            await apiClient.unlockSecrets(cachedSecretsPassword!);
          }
        }
      } catch { /* ignore */ }
    }

    const runningIds = isServerMode
      ? cells.filter(c => c.enabled).map(c => c.id)
      : cells.filter(c => c.enabled).map(c => c.id);

    set({
      cells,
      loaded: true,
      env,
      secretsLocked: blob !== null && !unlocked,
      secrets: decrypted,
      secretsBlob: blob,
      runningIds,
      queues,
      eventTopics,
      crons,
      languages,
    });

    // Cron polling — browser only; server handles its own cron scheduler
    if (!isServerMode) {
      setInterval(() => {
        const state = get();
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);
        for (const cron of state.crons) {
          if (!cron.enabled) continue;
          if (cron.lastRunAt) {
            const lastMinute = Math.floor(cron.lastRunAt / 60000);
            if (lastMinute >= currentMinute) continue;
          }
          if (!cronMatches(cron.expression, new Date(now))) continue;
          dispatchCron(cron, state);
          const runTs = Date.now();
          set(s => ({
            crons: s.crons.map(c => c.name === cron.name ? { ...c, lastRunAt: runTs } : c),
          }));
          persistCrons(get().crons);
        }
      }, 15000);

      setInterval(() => {
        const state = get();
        for (const q of Object.values(state.queues)) {
          if (q.messages.length === 0) continue;
          for (const subId of q.subscriberIds) {
            if (state.runningIds.includes(subId)) continue;
            const cell = state.cells.find(c => c.id === subId);
            if (!cell) continue;
            const msg = q.messages[0];
            scheduler?.runOnce(subId, parseMessageBody(msg.body));
            set(s => {
              const queues = { ...s.queues };
              queues[q.name] = { ...queues[q.name], messages: queues[q.name].messages.slice(1) };
              saveQueues(queues);
              return { queues };
            });
            break;
          }
        }
      }, 2000);
    }
  },

  addCell: async () => {
    const now = Date.now();
    const defaultLang = get().languages[0] || 'javascript';
    const isPython = defaultLang === 'python';
    const defaultScript = isPython
      ? `# Click ? Help for the full reference
#
# Quick globals: state props env secrets queue pubsub print console requests

print("Hello!")

state["counter"] = state.get("counter", 0) + 1
print("Run count:", state["counter"])
`
      : `// Click ? Help for the full reference
//
// Quick globals: $state $env $secrets $props $queue $pubsub fetch console loadPackage setTimeout signal

console.log("Hello!");

$state.counter = ($state.counter || 0) + 1;
console.log("Run count:", $state.counter);
`;
    const cell: Cell = {
      id: generateId(),
      name: `Script ${get().cells.length + 1}`,
      language: defaultLang as 'javascript' | 'python',
      script: defaultScript,
      intervalMs: 10000,
      enabled: false,
      lastRunAt: null,
      status: 'idle',
      output: [],
      state: {},
      params: '{}',
      createdAt: now,
      updatedAt: now,
    };
    if (isServerMode && apiClient) await apiClient.save(cell);
    else await storage.save(cell);
    set(state => ({ cells: [...state.cells, cell] }));
  },

  updateCell: async (id, updates) => {
    const state = get();
    const existing = state.cells.find(c => c.id === id);
    // If cell is locked by another client, reject updates to script/name/params
    if (existing?.lockedBy && existing.lockedBy !== state.clientId) {
      if ('script' in updates || 'name' in updates || 'params' in updates) return;
      // Allow non-content updates (like intervalMs) through
    }

    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      ),
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      if (isServerMode && apiClient) {
        try {
          await apiClient.save(cell);
        } catch { /* ignore server rejection (e.g. locked by other) */ }
      } else {
        await storage.save(cell);
        if (updates.intervalMs !== undefined && scheduler?.isRunning(id)) {
          scheduler.restart(id);
        }
      }
    }
  },

  deleteCell: async (id) => {
    if (isServerMode && apiClient) {
      await apiClient.delete(id);
    } else {
      scheduler?.stop(id);
      await storage.delete(id);
    }
    set(state => ({
      cells: state.cells.filter(c => c.id !== id),
      runningIds: state.runningIds.filter(rid => rid !== id),
    }));
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
      if (isServerMode && apiClient) {
        apiClient.save(cell);
        apiClient.startCell(id);
      } else {
        storage.save(cell);
        scheduler?.start(id);
      }
    }
  },

  stopCell: (id) => {
    if (isServerMode && apiClient) {
      apiClient.stopCell(id);
    } else {
      scheduler?.stop(id);
    }
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, enabled: false, updatedAt: Date.now() } : c
      ),
      runningIds: state.runningIds.filter(rid => rid !== id),
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      if (isServerMode && apiClient) apiClient.save(cell);
      else storage.save(cell);
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
      if (isServerMode && apiClient) {
        apiClient.save({ ...cell, enabled: true });
        apiClient.startCell(cell.id);
      } else {
        storage.save({ ...cell, enabled: true });
        scheduler?.start(cell.id);
      }
    }
  },

  stopAll: () => {
    if (isServerMode && apiClient) {
      for (const cell of get().cells) {
        if (cell.enabled) apiClient.stopCell(cell.id);
      }
    } else {
      scheduler?.stopAll();
    }
    set(state => ({
      cells: state.cells.map(c =>
        c.enabled ? { ...c, enabled: false, updatedAt: Date.now() } : c
      ),
      runningIds: [],
    }));
    for (const cell of get().cells) {
      if (isServerMode && apiClient) apiClient.save({ ...cell, enabled: false });
      else storage.save({ ...cell, enabled: false });
    }
  },

  runOnce: (id) => {
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, status: 'running' as const } : c
      ),
    }));
    if (isServerMode && apiClient) {
      apiClient.runOnce(id).then(result => {
        set(state => ({
          cells: state.cells.map(c =>
            c.id === id ? {
              ...c,
              status: result.success ? 'success' : 'error',
              lastRunAt: Date.now(),
              output: [...c.output, ...result.output].slice(-200),
              state: result.state,
              updatedAt: Date.now(),
            } : c
          ),
        }));
      }).catch(() => {});
    } else if (scheduler) {
      scheduler.runOnce(id);
    }
  },

  clearOutput: (id) => {
    set(state => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, output: [], updatedAt: Date.now() } : c
      ),
    }));
    const cell = get().cells.find(c => c.id === id);
    if (cell) {
      if (isServerMode && apiClient) apiClient.save(cell);
      else storage.save(cell);
    }
  },

  lockCell: async (id) => {
    const state = get();
    if (!isServerMode || !apiClient) {
      set({ editingCellId: id });
      return true;
    }

    if (state.editingCellId && state.editingCellId !== id) {
      await state.unlockCell(state.editingCellId);
    }

    try {
      const result = await apiClient.lockCell(id, state.clientId);
      if (result.ok) {
        set({ editingCellId: id });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  unlockCell: async (id) => {
    if (!isServerMode || !apiClient) {
      set(s => s.editingCellId === id ? { editingCellId: null } : {});
      return;
    }
    try {
      await apiClient.unlockCell(id, get().clientId);
    } catch { /* ignore */ }
    set(s => s.editingCellId === id ? { editingCellId: null } : {});
  },

  setEnvVar: (key, value) => {
    set(state => {
      const env = { ...state.env, [key]: value };
      if (isServerMode && apiClient) apiClient.saveEnv(env);
      else saveEnv(env);
      return { env };
    });
  },

  deleteEnvVar: (key) => {
    set(state => {
      const { [key]: _, ...env } = state.env;
      if (isServerMode && apiClient) apiClient.saveEnv(env);
      else saveEnv(env);
      return { env };
    });
  },

  tryUnlockSecrets: async (password) => {
    const blob = get().secretsBlob;
    if (!blob) return false;

    try {
      const currentHash = await hashPassword(password);
      if (currentHash !== blob.hash) return false;

      const values = await decryptSecrets(blob, password);
      cachedSecretsPassword = password;
      if (get().keepUnlocked) {
        saveSessionPassword(password);
      }
      set({ secretsLocked: false, secrets: values });
      // Sync password to server so it can decrypt its own copy of the blob
      if (isServerMode && apiClient) {
        apiClient.unlockSecrets(password);
      }
      return true;
    } catch {
      return false;
    }
  },

  lockSecrets: () => {
    cachedSecretsPassword = null;
    clearSessionPassword();
    set({ secretsLocked: true, secrets: {} });
    if (isServerMode && apiClient) {
      apiClient.lockSecrets();
    }
  },

  setSecret: async (key, value) => {
    const state = get();
    if (state.secretsLocked) return;

    const newValues = { ...state.secrets, [key]: value };
    const pw = cachedSecretsPassword;
    if (!pw) return;

    const blob = await encryptSecrets(newValues, pw);
    saveBlob(blob);
    set({ secrets: newValues, secretsBlob: blob });
    if (isServerMode && apiClient) {
      apiClient.putSecretsBlob(blob);
    }
  },

  deleteSecret: async (key) => {
    const state = get();
    if (state.secretsLocked) return;

    const { [key]: _, ...newValues } = state.secrets;
    const pw = cachedSecretsPassword;
    if (!pw) return;

    const blob = await encryptSecrets(newValues, pw);
    saveBlob(blob);
    set({ secrets: newValues, secretsBlob: blob });
    if (isServerMode && apiClient) {
      apiClient.putSecretsBlob(blob);
    }
  },

  setSecretsPassword: async (password) => {
    const blob = await encryptSecrets({}, password);
    saveBlob(blob);
    cachedSecretsPassword = password;
    if (get().keepUnlocked) {
      saveSessionPassword(password);
    }
    set({ secretsLocked: false, secrets: {}, secretsBlob: blob });
    if (isServerMode && apiClient) {
      apiClient.putSecretsBlob(blob);
      apiClient.unlockSecrets(password);
    }
  },

  removeSecretsPassword: async () => {
    clearBlob();
    cachedSecretsPassword = null;
    clearSessionPassword();
    set({ secretsLocked: true, secrets: {}, secretsBlob: null });
    if (isServerMode && apiClient) {
      apiClient.deleteSecretsAll();
    }
  },

  toggleKeepUnlocked: () => {
    const next = !get().keepUnlocked;
    saveKeepUnlocked(next);
    if (!next) {
      clearSessionPassword();
    } else if (cachedSecretsPassword) {
      saveSessionPassword(cachedSecretsPassword);
    }
    set({ keepUnlocked: next });
  },

  toggleSelected: (id, ctrl) => {
    set(state => {
      if (ctrl) {
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter(sid => sid !== id)
            : [...state.selectedIds, id],
        };
      }
      const alreadyOnly = state.selectedIds.length === 1 && state.selectedIds[0] === id;
      return { selectedIds: alreadyOnly ? [] : [id] };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  toggleKeepAlive: () => {
    const next = !get().keepAlive;
    set({ keepAlive: next });
    if (next) startKeepAlive();
    else stopKeepAlive();
  },

  startSelected: () => {
    const ids = get().selectedIds;
    for (const id of ids) {
      const cell = get().cells.find(c => c.id === id);
      if (cell && !cell.enabled) {
        set(state => ({
          cells: state.cells.map(c =>
            c.id === id ? { ...c, enabled: true, status: 'running' as const, updatedAt: Date.now() } : c
          ),
          runningIds: state.runningIds.includes(id) ? state.runningIds : [...state.runningIds, id],
        }));
        const updated = get().cells.find(c => c.id === id)!;
        if (isServerMode && apiClient) {
          apiClient.save(updated);
          apiClient.startCell(id);
        } else {
          storage.save(updated);
          scheduler?.start(id);
        }
      }
    }
  },

  stopSelected: () => {
    const ids = get().selectedIds;
    for (const id of ids) {
      const cell = get().cells.find(c => c.id === id);
      if (cell?.enabled) {
        if (isServerMode && apiClient) apiClient.stopCell(id);
        else scheduler?.stop(id);
        set(state => ({
          cells: state.cells.map(c =>
            c.id === id ? { ...c, enabled: false, updatedAt: Date.now() } : c
          ),
          runningIds: state.runningIds.filter(rid => rid !== id),
        }));
        const updated = get().cells.find(c => c.id === id)!;
        if (isServerMode && apiClient) apiClient.save(updated);
        else storage.save(updated);
      }
    }
  },

  deleteSelected: () => {
    const ids = get().selectedIds;
    for (const id of ids) {
      if (isServerMode && apiClient) apiClient.delete(id);
      else { scheduler?.stop(id); storage.delete(id); }
    }
    set(state => ({
      cells: state.cells.filter(c => !ids.includes(c.id)),
      runningIds: state.runningIds.filter(rid => !ids.includes(rid)),
      selectedIds: [],
    }));
  },

  addQueue: (name, maxRetries) => {
    set(state => {
      if (state.queues[name]) return state;
      const queues = { ...state.queues, [name]: { name, maxRetries, subscriberIds: [], messages: [] } };
      persistQueues(queues);
      return { queues };
    });
  },

  deleteQueue: (name) => {
    set(state => {
      const { [name]: _, ...queues } = state.queues;
      persistQueues(queues);
      return { queues };
    });
  },

  enqueue: (name, body) => {
    set(state => {
      const queue = state.queues[name];
      if (!queue) return state;
      const msg: QueueMessage = { id: generateId(), body, timestamp: Date.now(), retries: 0 };
      const queues = { ...state.queues, [name]: { ...queue, messages: [...queue.messages, msg] } };
      persistQueues(queues);
      return { queues };
    });
  },

  addQueueSubscriber: (queueName, cellId) => {
    set(state => {
      const queue = state.queues[queueName];
      if (!queue || queue.subscriberIds.includes(cellId)) return state;
      const queues = { ...state.queues, [queueName]: { ...queue, subscriberIds: [...queue.subscriberIds, cellId] } };
      persistQueues(queues);
      return { queues };
    });
  },

  removeQueueSubscriber: (queueName, cellId) => {
    set(state => {
      const queue = state.queues[queueName];
      if (!queue) return state;
      const queues = { ...state.queues, [queueName]: { ...queue, subscriberIds: queue.subscriberIds.filter(id => id !== cellId) } };
      persistQueues(queues);
      return { queues };
    });
  },

  addEventTopic: (name) => {
    set(state => {
      if (state.eventTopics[name]) return state;
      const eventTopics = { ...state.eventTopics, [name]: { name, subscriberIds: [] } };
      persistTopics(eventTopics);
      return { eventTopics };
    });
  },

  deleteEventTopic: (name) => {
    set(state => {
      const { [name]: _, ...eventTopics } = state.eventTopics;
      persistTopics(eventTopics);
      return { eventTopics };
    });
  },

  emitEvent: (name, body) => {
    const state = get();
    const topic = state.eventTopics[name];
    if (!topic) return;
    if (isServerMode && apiClient) {
      apiClient.emitEvent(name, body);
    } else {
      for (const cellId of topic.subscriberIds) {
        scheduler?.runOnce(cellId, parseMessageBody(body));
      }
    }
  },

  addEventSubscriber: (topicName, cellId) => {
    set(state => {
      const topic = state.eventTopics[topicName];
      if (!topic || topic.subscriberIds.includes(cellId)) return state;
      const eventTopics = { ...state.eventTopics, [topicName]: { ...topic, subscriberIds: [...topic.subscriberIds, cellId] } };
      persistTopics(eventTopics);
      return { eventTopics };
    });
  },

  removeEventSubscriber: (topicName, cellId) => {
    set(state => {
      const topic = state.eventTopics[topicName];
      if (!topic) return state;
      const eventTopics = { ...state.eventTopics, [topicName]: { ...topic, subscriberIds: topic.subscriberIds.filter(id => id !== cellId) } };
      persistTopics(eventTopics);
      return { eventTopics };
    });
  },

  addCron: (entry) => {
    set(state => {
      // If secrets are locked and this cron targets a script using $secrets, start disabled
      const shouldDisable = state.secretsLocked && entry.target.type === 'cell' && (() => {
        const cell = state.cells.find(c => c.id === entry.target.name || c.name === entry.target.name);
        return cell ? /\$secrets[\.\[]\s*['"\w]/.test(cell.script) : false;
      })();
      const crons = [...state.crons, { ...entry, lastRunAt: null, enabled: shouldDisable ? false : entry.enabled }];
      persistCrons(crons);
      return { crons };
    });
  },

  deleteCron: (name) => {
    set(state => {
      const crons = state.crons.filter(c => c.name !== name);
      persistCrons(crons);
      return { crons };
    });
  },

  toggleCron: (name) => {
    const state = get();
    const cron = state.crons.find(c => c.name === name);
    if (!cron) return;

    // Prevent enabling a cron targeting a secret-using script when secrets are locked
    if (!cron.enabled && state.secretsLocked && cronTargetsSecrets(cron, state.cells)) {
      return;
    }

    set(state => {
      const crons = state.crons.map(c => c.name === name ? { ...c, enabled: !c.enabled } : c);
      persistCrons(crons);
      return { crons };
    });
  },

  runCronNow: (name) => {
    const state = get();
    const cron = state.crons.find(c => c.name === name);
    if (!cron) return;
    dispatchCron(cron, state);
    set(s => ({
      crons: s.crons.map(c => c.name === name ? { ...c, lastRunAt: Date.now() } : c),
    }));
    persistCrons(get().crons);
  },

  editCron: (name, updates) => {
    set(state => {
      const crons = state.crons.map(c =>
        c.name === name ? { ...c, ...updates, target: updates.target ?? c.target } : c
      );
      persistCrons(crons);
      return { crons };
    });
  },
}));

function dispatchCron(cron: CronEntry, state: ReturnType<typeof useCellsStore.getState>): void {
  const props = parseMessageBody(cron.payload);
  switch (cron.target.type) {
    case 'cell': {
      const cell = state.cells.find(c => c.name === cron.target.name || c.id === cron.target.name);
      if (cell) {
        if (isServerMode && apiClient) apiClient.runOnce(cell.id, props);
        else scheduler?.runOnce(cell.id, props);
      }
      break;
    }
    case 'queue':
      state.enqueue(cron.target.name, cron.payload);
      break;
    case 'pubsub':
      if (isServerMode && apiClient) apiClient.emitEvent(cron.target.name, cron.payload);
      else state.emitEvent(cron.target.name, cron.payload);
      break;
  }
}

let wakeLock: WakeLockSentinel | null = null;
let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;

async function startKeepAlive(): Promise<void> {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* not supported */ }

  try {
    audioCtx = new AudioContext();
    oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.001;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
  } catch { /* not supported */ }
}

function stopKeepAlive(): void {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  oscillator?.stop();
  oscillator = null;
  audioCtx?.close();
  audioCtx = null;
}
