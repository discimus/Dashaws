import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createApiRouter } from './api/routes.js';
import { initServer, cells, serverQueues, serverEventTopics, serverCrons } from './api/state.js';
import { setPassword, createAuthMiddleware, createToken, setAuthCookie, clearAuthCookie, extractToken, removeToken, getClientIP, checkRateLimit, recordFailedAttempt, clearFailedAttempts, cleanupFailedAttempts, failedAttempts, authEnabled, serverPassword, } from './api/auth.js';
const PORT = parseInt(process.env.PORT || '3456', 10);
const configSearchPaths = [
    join(process.cwd(), '..', 'dashaws.config.json'),
    join(process.cwd(), 'dashaws.config.json'),
];
for (const p of configSearchPaths) {
    try {
        if (existsSync(p)) {
            const config = JSON.parse(readFileSync(p, 'utf-8'));
            setPassword(config.password || null);
            if (authEnabled) {
                console.log('[auth] Password loaded from config file');
                break;
            }
        }
    }
    catch { /* ignore */ }
}
if (!authEnabled) {
    console.log('[auth] No password configured — authentication disabled');
}
setInterval(() => cleanupFailedAttempts(), 60 * 1000);
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
app.use('/api', createAuthMiddleware());
app.post('/api/auth/login', (req, res) => {
    if (!authEnabled) {
        return res.json({ token: 'no-auth-required' });
    }
    const ip = getClientIP(req);
    const retryAfter = checkRateLimit(ip);
    if (retryAfter !== null) {
        return res.status(429).json({
            error: 'Too many attempts. Please wait.',
            retryAfter,
            attempts: failedAttempts.get(ip).count,
        });
    }
    const { password } = req.body || {};
    if (!password || password !== serverPassword) {
        recordFailedAttempt(ip);
        const entry = failedAttempts.get(ip);
        return res.status(401).json({
            error: 'Invalid password',
            attempts: entry.count,
        });
    }
    clearFailedAttempts(ip);
    const token = createToken();
    setAuthCookie(res, token);
    res.json({ token });
});
app.get('/api/auth/status', (_req, res) => {
    res.json({ authEnabled });
});
app.get('/api/auth/verify', (_req, res) => {
    res.json({ authenticated: true });
});
app.post('/api/auth/logout', (req, res) => {
    const token = extractToken(req);
    if (token) {
        removeToken(token);
    }
    clearAuthCookie(res);
    res.json({ ok: true });
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