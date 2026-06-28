import { Router } from 'express';
import { serverEnv, serverSecrets, savePersistedState, serverQueues, serverEventTopics, serverCrons, cells, scheduler, syncCell, removeCell, storage } from './state.js';
export function createApiRouter() {
    const router = Router();
    router.get('/health', (_req, res) => {
        res.json({ ok: true, timestamp: Date.now() });
    });
    router.get('/cells', async (_req, res) => {
        res.json(cells);
    });
    router.get('/cells/:id', async (req, res) => {
        const id = req.params.id;
        const cell = cells.find(c => c.id === id);
        if (!cell)
            return res.status(404).json({ error: 'Not found' });
        res.json(cell);
    });
    router.put('/cells/:id', async (req, res) => {
        const id = req.params.id;
        const cell = { ...req.body, id, updatedAt: Date.now() };
        await syncCell(cell);
        res.json(cell);
    });
    router.delete('/cells/:id', async (req, res) => {
        const id = req.params.id;
        await removeCell(id);
        res.json({ ok: true });
    });
    router.post('/cells/:id/run', async (req, res) => {
        const id = req.params.id;
        const cell = cells.find(c => c.id === id);
        if (!cell)
            return res.status(404).json({ error: 'Not found' });
        if (!scheduler)
            return res.status(503).json({ error: 'Scheduler not ready' });
        const props = req.body && typeof req.body === 'object' ? req.body : undefined;
        const result = await scheduler.runOnce(id, props);
        res.json(result);
    });
    router.post('/cells/:id/start', async (req, res) => {
        const id = req.params.id;
        const cell = cells.find(c => c.id === id);
        if (!cell)
            return res.status(404).json({ error: 'Not found' });
        cell.enabled = true;
        await storage.save(cell);
        scheduler?.start(id);
        res.json({ ok: true });
    });
    router.post('/cells/:id/stop', async (req, res) => {
        const id = req.params.id;
        const cell = cells.find(c => c.id === id);
        if (!cell)
            return res.status(404).json({ error: 'Not found' });
        cell.enabled = false;
        await storage.save(cell);
        scheduler?.stop(id);
        res.json({ ok: true });
    });
    router.get('/env', (_req, res) => res.json(serverEnv));
    router.put('/env', (req, res) => {
        Object.assign(serverEnv, req.body);
        for (const k of Object.keys(serverEnv)) {
            if (!(k in req.body))
                delete serverEnv[k];
        }
        savePersistedState();
        res.json(serverEnv);
    });
    router.get('/secrets', (_req, res) => res.json(serverSecrets));
    router.put('/secrets', (req, res) => {
        Object.assign(serverSecrets, req.body);
        for (const k of Object.keys(serverSecrets)) {
            if (!(k in req.body))
                delete serverSecrets[k];
        }
        savePersistedState();
        res.json(serverSecrets);
    });
    router.get('/queues', (_req, res) => res.json(serverQueues));
    router.put('/queues', (req, res) => {
        for (const k of Object.keys(serverQueues))
            delete serverQueues[k];
        Object.assign(serverQueues, req.body);
        savePersistedState();
        res.json(serverQueues);
    });
    router.get('/topics', (_req, res) => res.json(serverEventTopics));
    router.put('/topics', (req, res) => {
        for (const k of Object.keys(serverEventTopics))
            delete serverEventTopics[k];
        Object.assign(serverEventTopics, req.body);
        savePersistedState();
        res.json(serverEventTopics);
    });
    router.post('/topics/:name/emit', (req, res) => {
        const name = req.params.name;
        const topic = serverEventTopics[name];
        if (!topic)
            return res.status(404).json({ error: 'Topic not found' });
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        for (const cellId of topic.subscriberIds) {
            scheduler?.runOnce(cellId);
        }
        res.json({ ok: true });
    });
    router.get('/crons', (_req, res) => res.json(serverCrons));
    router.put('/crons', (req, res) => {
        serverCrons.length = 0;
        serverCrons.push(...(req.body || []));
        savePersistedState();
        res.json(serverCrons);
    });
    return router;
}
//# sourceMappingURL=routes.js.map