import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { existsSync } from 'fs';
import { createApiRouter } from './api/routes.js';
import { initServer, cells, serverQueues, serverEventTopics, serverCrons } from './api/state.js';
const PORT = parseInt(process.env.PORT || '3456', 10);
await initServer();
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
app.use('/api', createApiRouter());
const distPath = join(process.cwd(), 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((_req, res) => {
        res.sendFile(join(distPath, 'index.html'));
    });
}
else {
    app.get('/', (_req, res) => {
        res.json({ message: 'SPA not built. Run: npm run build:all' });
    });
}
const server = createServer(app);
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Cells: ${cells.length}`);
    console.log(`Queues: ${Object.keys(serverQueues).length}, Topics: ${Object.keys(serverEventTopics).length}, Crons: ${serverCrons.length}`);
});
//# sourceMappingURL=index.js.map