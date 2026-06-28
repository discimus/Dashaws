import { Router, type Request, type Response } from 'express';
import { serverEnv, serverSecrets, savePersistedState, serverQueues, serverEventTopics, serverCrons, cells, scheduler, syncCell, removeCell, storage } from './state.js';
import type { Cell } from '../../src/types/cell.js';

export function createApiRouter(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  router.get('/cells', async (_req: Request, res: Response) => {
    res.json(cells);
  });

  router.get('/cells/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell = cells.find(c => c.id === id);
    if (!cell) return res.status(404).json({ error: 'Not found' });
    res.json(cell);
  });

  router.put('/cells/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell: Cell = { ...req.body, id, updatedAt: Date.now() };
    await syncCell(cell);
    res.json(cell);
  });

  router.delete('/cells/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await removeCell(id);
    res.json({ ok: true });
  });

  router.post('/cells/:id/run', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell = cells.find(c => c.id === id);
    if (!cell) return res.status(404).json({ error: 'Not found' });
    if (!scheduler) return res.status(503).json({ error: 'Scheduler not ready' });
    const props = req.body && typeof req.body === 'object' ? req.body : undefined;
    const result = await scheduler.runOnce(id, props as Record<string, unknown> | undefined);
    res.json(result);
  });

  router.post('/cells/:id/start', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell = cells.find(c => c.id === id);
    if (!cell) return res.status(404).json({ error: 'Not found' });
    cell.enabled = true;
    await storage.save(cell);
    scheduler?.start(id);
    res.json({ ok: true });
  });

  router.post('/cells/:id/stop', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell = cells.find(c => c.id === id);
    if (!cell) return res.status(404).json({ error: 'Not found' });
    cell.enabled = false;
    await storage.save(cell);
    scheduler?.stop(id);
    res.json({ ok: true });
  });

  router.get('/env', (_req: Request, res: Response) => res.json(serverEnv));

  router.put('/env', (req: Request, res: Response) => {
    Object.assign(serverEnv, req.body);
    for (const k of Object.keys(serverEnv)) { if (!(k in req.body)) delete serverEnv[k]; }
    savePersistedState();
    res.json(serverEnv);
  });

  router.get('/secrets', (_req: Request, res: Response) => res.json(serverSecrets));

  router.put('/secrets', (req: Request, res: Response) => {
    Object.assign(serverSecrets, req.body);
    for (const k of Object.keys(serverSecrets)) { if (!(k in req.body)) delete serverSecrets[k]; }
    savePersistedState();
    res.json(serverSecrets);
  });

  router.get('/queues', (_req: Request, res: Response) => res.json(serverQueues));
  router.put('/queues', (req: Request, res: Response) => {
    for (const k of Object.keys(serverQueues)) delete serverQueues[k];
    Object.assign(serverQueues, req.body);
    savePersistedState();
    res.json(serverQueues);
  });

  router.get('/topics', (_req: Request, res: Response) => res.json(serverEventTopics));
  router.put('/topics', (req: Request, res: Response) => {
    for (const k of Object.keys(serverEventTopics)) delete serverEventTopics[k];
    Object.assign(serverEventTopics, req.body);
    savePersistedState();
    res.json(serverEventTopics);
  });

  router.post('/topics/:name/emit', (req: Request, res: Response) => {
    const name = req.params.name as string;
    const topic = serverEventTopics[name];
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    for (const cellId of topic.subscriberIds) {
      scheduler?.runOnce(cellId);
    }
    res.json({ ok: true });
  });

  router.get('/crons', (_req: Request, res: Response) => res.json(serverCrons));
  router.put('/crons', (req: Request, res: Response) => {
    serverCrons.length = 0;
    serverCrons.push(...(req.body || []));
    savePersistedState();
    res.json(serverCrons);
  });

  return router;
}
