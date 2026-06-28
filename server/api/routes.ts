import { Router, type Request, type Response } from 'express';
import { storage, serverEnv, savePersistedState, serverQueues, serverEventTopics, serverCrons } from './state.js';
import type { Cell } from '../../src/types/cell.js';

export function createApiRouter(
  onEventEmit: (name: string, body: string) => void
): Router {
  const router = Router();

  router.get('/cells', async (_req: Request, res: Response) => {
    res.json(await storage.list());
  });

  router.get('/cells/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell = await storage.get(id);
    if (!cell) return res.status(404).json({ error: 'Not found' });
    res.json(cell);
  });

  router.put('/cells/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const cell: Cell = { ...req.body, id, updatedAt: Date.now() };
    await storage.save(cell);
    res.json(cell);
  });

  router.delete('/cells/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await storage.delete(id);
    res.json({ ok: true });
  });

  router.get('/env', (_req: Request, res: Response) => res.json(serverEnv));

  router.put('/env', (req: Request, res: Response) => {
    Object.assign(serverEnv, req.body);
    for (const k of Object.keys(serverEnv)) { if (!(k in req.body)) delete serverEnv[k]; }
    savePersistedState();
    res.json(serverEnv);
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
    onEventEmit(name, typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    res.json({ ok: true });
  });

  router.get('/crons', (_req: Request, res: Response) => res.json(serverCrons));
  router.put('/crons', (req: Request, res: Response) => {
    serverCrons.length = 0;
    serverCrons.push(...(req.body || []));
    savePersistedState();
    res.json(serverCrons);
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  return router;
}
