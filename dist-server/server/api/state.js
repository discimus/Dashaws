import { FileStorageBackend } from '../storage/file-storage.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
const storage = new FileStorageBackend();
const DATA_DIR = process.env.SCRIPT_DASHBOARD_DATA_DIR || join(process.cwd(), 'data');
export let serverEnv = {};
export let serverQueues = {};
export let serverEventTopics = {};
export let serverCrons = [];
export function initServerState() {
    if (!existsSync(DATA_DIR))
        mkdirSync(DATA_DIR, { recursive: true });
    try {
        const p = join(DATA_DIR, 'env.json');
        if (existsSync(p))
            serverEnv = JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch { /* ignore */ }
    try {
        const p = join(DATA_DIR, 'queues.json');
        if (existsSync(p))
            serverQueues = JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch { /* ignore */ }
    try {
        const p = join(DATA_DIR, 'topics.json');
        if (existsSync(p))
            serverEventTopics = JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch { /* ignore */ }
    try {
        const p = join(DATA_DIR, 'crons.json');
        if (existsSync(p))
            serverCrons = JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch { /* ignore */ }
}
export function savePersistedState() {
    if (!existsSync(DATA_DIR))
        mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(join(DATA_DIR, 'env.json'), JSON.stringify(serverEnv, null, 2));
    writeFileSync(join(DATA_DIR, 'queues.json'), JSON.stringify(serverQueues, null, 2));
    writeFileSync(join(DATA_DIR, 'topics.json'), JSON.stringify(serverEventTopics, null, 2));
    writeFileSync(join(DATA_DIR, 'crons.json'), JSON.stringify(serverCrons, null, 2));
}
export { storage };
//# sourceMappingURL=state.js.map