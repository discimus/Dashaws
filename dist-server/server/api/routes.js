import { Router } from 'express';
import { storage, serverEnv, savePersistedState, serverQueues, serverEventTopics, serverCrons } from './state.js';
export function createApiRouter(onEventEmit) {
    const router = Router();
    router.get('/cells', async (_req, res) => {
        res.json(await storage.list());
    });
    router.get('/cells/:id', async (req, res) => {
        const id = req.params.id;
        const cell = await storage.get(id);
        if (!cell)
            return res.status(404).json({ error: 'Not found' });
        res.json(cell);
    });
    router.put('/cells/:id', async (req, res) => {
        const id = req.params.id;
        const cell = { ...req.body, id, updatedAt: Date.now() };
        await storage.save(cell);
        res.json(cell);
    });
    router.delete('/cells/:id', async (req, res) => {
        const id = req.params.id;
        await storage.delete(id);
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
        onEventEmit(name, typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
        res.json({ ok: true });
    });
    router.get('/crons', (_req, res) => res.json(serverCrons));
    router.put('/crons', (req, res) => {
        serverCrons.length = 0;
        serverCrons.push(...(req.body || []));
        savePersistedState();
        res.json(serverCrons);
    });
    router.get('/health', (_req, res) => {
        res.json({ ok: true, timestamp: Date.now() });
    });
    return router;
}
//# sourceMappingURL=routes.js.map