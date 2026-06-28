import express from 'express';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createApiRouter } from './api/routes.js';
import { initServerState, serverQueues, serverEventTopics, serverCrons, serverEnv } from './api/state.js';
import { FileStorageBackend } from './storage/file-storage.js';
import { ServerScheduler } from './sandbox/scheduler.js';
import type { Cell } from '../src/types/cell.js';
import { parseMessageBody } from '../src/shared/parse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = parseInt(process.env.PORT || '3456', 10);

initServerState();

const storage = new FileStorageBackend();
let cells: Cell[] = [];
let scheduler: ServerScheduler | null = null;

async function initScheduler(): Promise<void> {
  cells = await storage.list();

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
    () => ({ env: { ...serverEnv }, secrets: new Set<string>(), secretsObj: {} }),
    () => ({ queues: serverQueues, eventTopics: serverEventTopics, crons: serverCrons }),
    (name, body) => {
      const topic = serverEventTopics[name];
      if (!topic) return;
      for (const cellId of topic.subscriberIds) {
        const cell = cells.find(c => c.id === cellId);
        if (cell) scheduler?.runOnce(cellId, parseMessageBody(body));
      }
    }
  );

  const running = cells.filter(c => c.enabled);
  for (const cell of running) {
    scheduler.start(cell.id);
  }

  scheduler.startQueuePolling();
  scheduler.startCronPolling();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const apiRouter = createApiRouter((name, body) => {
  const topic = serverEventTopics[name];
  if (!topic) return;
  for (const cellId of topic.subscriberIds) {
    const cell = cells.find(c => c.id === cellId);
    if (cell) scheduler?.runOnce(cellId, parseMessageBody(body));
  }
});
app.use('/api', apiRouter);

const distPath = join(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'SPA not built. Run: npm run build:all' });
  });
}

const server = createServer(app);

server.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  await initScheduler();
  console.log(`Cells loaded: ${cells.length}`);
  console.log(`Queues: ${Object.keys(serverQueues).length}, Topics: ${Object.keys(serverEventTopics).length}, Crons: ${serverCrons.length}`);
});
