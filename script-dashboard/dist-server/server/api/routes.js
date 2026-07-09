import { Router } from 'express';
import { serverEnv, serverSecrets, serverSecretsBlob, serverSecretsPassword, savePersistedState, serverQueues, serverEventTopics, serverCrons, cells, scheduler, syncCell, removeCell, storage, unlockSecrets, lockSecrets, setSecretsBlob, clearSecretsAll, serverLanguages, lockCell, unlockCell } from './state.js';
export function createApiRouter() {
    const router = Router();
    router.get('/health', (_req, res) => {
        res.json({ ok: true, timestamp: Date.now() });
    });
    router.get('/languages', (_req, res) => {
        res.json(serverLanguages);
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
        const allowed = ['name', 'language', 'script', 'intervalMs', 'enabled', 'params', 'status', 'output', 'state', 'createdAt', 'lockedBy', 'lockedAt'];
        const filtered = {};
        for (const k of allowed) {
            if (Object.hasOwn(req.body, k)) {
                filtered[k] = req.body[k];
            }
        }
        const cell = { ...filtered, id, updatedAt: Date.now() };
        await syncCell(cell);
        res.json(cell);
    });
    router.delete('/cells/:id', async (req, res) => {
        const id = req.params.id;
        await removeCell(id);
        res.json({ ok: true });
    });
    router.post('/cells/:id/lock', async (req, res) => {
        const id = req.params.id;
        const { clientId } = req.body || {};
        if (!clientId || typeof clientId !== 'string') {
            return res.status(400).json({ error: 'clientId required' });
        }
        const result = lockCell(id, clientId);
        if (result.ok) {
            res.json({ ok: true });
        }
        else {
            res.status(409).json({ error: 'Locked by another client', lockedBy: result.owner });
        }
    });
    router.post('/cells/:id/unlock', async (req, res) => {
        const id = req.params.id;
        const { clientId } = req.body || {};
        if (!clientId || typeof clientId !== 'string') {
            return res.status(400).json({ error: 'clientId required' });
        }
        unlockCell(id, clientId);
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
        const body = req.body || {};
        if (typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ error: 'Expected object' });
        }
        for (const k of Object.keys(body)) {
            if (typeof k !== 'string' || k.length > 128)
                continue;
            if (typeof body[k] !== 'string')
                continue;
            if (body[k].length > 4096)
                continue;
            serverEnv[k] = body[k];
        }
        for (const k of Object.keys(serverEnv)) {
            if (!Object.hasOwn(body, k))
                delete serverEnv[k];
        }
        savePersistedState();
        res.json(serverEnv);
    });
    router.get('/secrets/status', (_req, res) => {
        res.json({
            hasBlob: serverSecretsBlob !== null,
            unlocked: serverSecretsPassword !== null && Object.keys(serverSecrets).length > 0,
        });
    });
    router.post('/secrets/unlock', async (req, res) => {
        const { password } = req.body || {};
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ error: 'Password required' });
        }
        const ok = await unlockSecrets(password);
        if (!ok)
            return res.status(401).json({ error: 'Invalid password or no blob stored' });
        res.json({ ok: true });
    });
    router.post('/secrets/lock', (_req, res) => {
        lockSecrets();
        res.json({ ok: true });
    });
    router.put('/secrets', async (req, res) => {
        const blob = req.body;
        if (!blob || !blob.iv || !blob.data || !blob.salt || !blob.hash) {
            return res.status(400).json({ error: 'Invalid encrypted blob' });
        }
        await setSecretsBlob(blob);
        res.json({ ok: true });
    });
    router.delete('/secrets', (_req, res) => {
        clearSecretsAll();
        res.json({ ok: true });
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
        if (serverSecretsBlob && !serverSecretsPassword) {
            lockSecrets(); // Re-applies auto-disable for any secret-dependent crons
        }
        else {
            savePersistedState();
        }
        res.json(serverCrons);
    });
    return router;
}
//# sourceMappingURL=routes.js.map