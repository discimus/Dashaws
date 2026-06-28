import express from 'express';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { createApiRouter } from './api/routes.js';
import { initServerState, serverQueues, serverEventTopics, serverCrons, serverEnv } from './api/state.js';
import { FileStorageBackend } from './storage/file-storage.js';
import { ServerScheduler } from './sandbox/scheduler.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = parseInt(process.env.PORT || '3456', 10);
initServerState();
const storage = new FileStorageBackend();
let cells = [];
let scheduler = null;
function parseMessageBody(body) {
    try {
        const parsed = JSON.parse(body);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : { message: body };
    }
    catch {
        return { message: body };
    }
}
async function initScheduler() {
    cells = await storage.list();
    scheduler = new ServerScheduler((id) => cells.find(c => c.id === id), async (id, result) => {
        const cell = cells.find(c => c.id === id);
        if (cell) {
            cell.status = result.success ? 'success' : 'error';
            cell.lastRunAt = Date.now();
            cell.output = [...(cell.output || []), ...result.output].slice(-200);
            cell.state = result.state;
            await storage.save(cell);
        }
    }, () => ({ env: { ...serverEnv }, secrets: new Set(), secretsObj: {} }), () => ({ queues: serverQueues, eventTopics: serverEventTopics, crons: serverCrons }), (name, body) => {
        const topic = serverEventTopics[name];
        if (!topic)
            return;
        for (const cellId of topic.subscriberIds) {
            const cell = cells.find(c => c.id === cellId);
            if (cell)
                scheduler?.runOnce(cellId, parseMessageBody(body));
        }
    });
    const running = cells.filter(c => c.enabled);
    for (const cell of running) {
        scheduler.start(cell.id);
    }
    scheduler.startQueuePolling();
    scheduler.startCronPolling();
}
const app = express();
app.use(express.json({ limit: '10mb' }));
const apiRouter = createApiRouter((name, body) => {
    const topic = serverEventTopics[name];
    if (!topic)
        return;
    for (const cellId of topic.subscriberIds) {
        const cell = cells.find(c => c.id === cellId);
        if (cell)
            scheduler?.runOnce(cellId, parseMessageBody(body));
    }
});
app.use('/api', apiRouter);
const distPath = join(__dirname, '..', '..', 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((_req, res, next) => {
        res.sendFile(join(distPath, 'index.html'));
    });
}
const server = createServer(app);
server.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    await initScheduler();
    console.log(`Cells loaded: ${cells.length}`);
    console.log(`Queues: ${Object.keys(serverQueues).length}, Topics: ${Object.keys(serverEventTopics).length}, Crons: ${serverCrons.length}`);
});
//# sourceMappingURL=index.js.map