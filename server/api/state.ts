import { FileStorageBackend } from '../storage/file-storage.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { Cell, Queue, EventTopic, CronEntry } from '../../src/types/cell.js';
import { ServerScheduler } from '../sandbox/scheduler.js';
import { parseMessageBody } from '../../src/shared/parse.js';
import type { EncryptedBlob } from '../../src/crypto/secrets.js';
import { decryptSecrets } from '../../src/crypto/secrets.js';

const storage = new FileStorageBackend();
const DATA_DIR = process.env.DASHAWS_DATA_DIR || join(process.cwd(), 'data');

export let serverEnv: Record<string, string> = {};
export let serverSecretsBlob: EncryptedBlob | null = null;
export let serverSecrets: Record<string, string> = {};
export let serverSecretsPassword: string | null = null;
export let serverQueues: Record<string, Queue> = {};
export let serverEventTopics: Record<string, EventTopic> = {};
export let serverCrons: CronEntry[] = [];
export let cells: Cell[] = [];
export let scheduler: ServerScheduler | null = null;
export let autoDisabledCronNames: Set<string> = new Set();
export { storage };

export function initServerState(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  try { const p = join(DATA_DIR, 'env.json'); if (existsSync(p)) serverEnv = JSON.parse(readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  try { const p = join(DATA_DIR, 'secrets.enc.json'); if (existsSync(p)) serverSecretsBlob = JSON.parse(readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  try { const p = join(DATA_DIR, 'queues.json'); if (existsSync(p)) serverQueues = JSON.parse(readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  try { const p = join(DATA_DIR, 'topics.json'); if (existsSync(p)) serverEventTopics = JSON.parse(readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  try { const p = join(DATA_DIR, 'crons.json'); if (existsSync(p)) serverCrons = JSON.parse(readFileSync(p, 'utf-8')); } catch { /* ignore */ }
}

export function savePersistedState(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'env.json'), JSON.stringify(serverEnv, null, 2));
  if (serverSecretsBlob) {
    writeFileSync(join(DATA_DIR, 'secrets.enc.json'), JSON.stringify(serverSecretsBlob, null, 2));
  }
  writeFileSync(join(DATA_DIR, 'queues.json'), JSON.stringify(serverQueues, null, 2));
  writeFileSync(join(DATA_DIR, 'topics.json'), JSON.stringify(serverEventTopics, null, 2));
  writeFileSync(join(DATA_DIR, 'crons.json'), JSON.stringify(serverCrons, null, 2));
}

export async function syncCell(cell: Cell): Promise<void> {
  await storage.save(cell);
  const idx = cells.findIndex(c => c.id === cell.id);
  if (idx >= 0) {
    cells[idx] = cell;
  } else {
    cells.push(cell);
  }
  if (scheduler && cell.enabled) {
    if (scheduler.getRunningIds().includes(cell.id)) {
      scheduler.restart(cell.id);
    } else {
      scheduler.start(cell.id);
    }
  }
}

export async function removeCell(id: string): Promise<void> {
  await storage.delete(id);
  scheduler?.stop(id);
  const idx = cells.findIndex(c => c.id === id);
  if (idx >= 0) cells.splice(idx, 1);
}

function cellUsesSecrets(script: string): boolean {
  return /\$secrets[\.\[]\s*['"\w]/.test(script);
}

function autoDisableSecretCrons(): void {
  const secretNames = new Set<string>();
  for (const cell of cells) {
    if (cellUsesSecrets(cell.script)) {
      secretNames.add(cell.id);
      secretNames.add(cell.name);
    }
  }
  for (const cron of serverCrons) {
    if (cron.target.type !== 'cell') continue;
    if (secretNames.has(cron.target.name) && cron.enabled) {
      cron.enabled = false;
      autoDisabledCronNames.add(cron.name);
    }
  }
  savePersistedState();
}

function reEnableAutoDisabledCrons(): void {
  for (const cron of serverCrons) {
    if (autoDisabledCronNames.has(cron.name)) {
      cron.enabled = true;
    }
  }
  autoDisabledCronNames.clear();
  savePersistedState();
}

export async function unlockSecrets(password: string): Promise<boolean> {
  if (!serverSecretsBlob) return false;
  try {
    serverSecrets = await decryptSecrets(serverSecretsBlob, password);
    serverSecretsPassword = password;
    reEnableAutoDisabledCrons();
    return true;
  } catch {
    return false;
  }
}

export function lockSecrets(): void {
  serverSecrets = {};
  serverSecretsPassword = null;
  autoDisableSecretCrons();
}

export async function setSecretsBlob(blob: EncryptedBlob): Promise<void> {
  serverSecretsBlob = blob;
  savePersistedState();
  if (serverSecretsPassword) {
    try {
      serverSecrets = await decryptSecrets(blob, serverSecretsPassword);
    } catch { /* password mismatch with new blob — keep old in-memory state */ }
  }
}

export function clearSecretsAll(): void {
  serverSecretsBlob = null;
  serverSecrets = {};
  serverSecretsPassword = null;
  autoDisabledCronNames.clear();
  const p = join(DATA_DIR, 'secrets.enc.json');
  try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
}

export async function initServer(): Promise<void> {
  initServerState();
  cells = await storage.list();

  const onEmit = (name: string, body: string) => {
    const topic = serverEventTopics[name];
    if (!topic) return;
    for (const cellId of topic.subscriberIds) {
      const cell = cells.find(c => c.id === cellId);
      if (cell) scheduler?.runOnce(cellId, parseMessageBody(body));
    }
  };

  scheduler = new ServerScheduler(
    (id) => cells.find(c => c.id === id),
    async (id, result) => {
      const cell = cells.find(c => c.id === id);
      if (cell) {
        cell.status = result.success ? 'success' : 'error';
        cell.lastRunAt = Date.now();
        cell.output = [...(cell.output || []), ...result.output].slice(-200);
        cell.state = result.state;
        await storage.save(cell);
      }
    },
    () => ({ env: { ...serverEnv }, secrets: new Set(Object.values(serverSecrets)), secretsObj: { ...serverSecrets } }),
    () => ({ queues: serverQueues, eventTopics: serverEventTopics, crons: serverCrons }),
    onEmit
  );

  const running = cells.filter(c => c.enabled);
  for (const cell of running) {
    scheduler.start(cell.id);
  }

  scheduler.startQueuePolling();
  scheduler.startCronPolling();

  // If secrets blob exists but not unlocked, auto-disable crons for secret-using scripts
  if (serverSecretsBlob && !serverSecretsPassword) {
    autoDisableSecretCrons();
  }
}
