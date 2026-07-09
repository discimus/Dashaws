import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { createApiRouter } from './api/routes.js';
import { initServer, cells, serverQueues, serverEventTopics, serverCrons } from './api/state.js';
const PORT = parseInt(process.env.PORT || '3456', 10);
let serverPassword = null;
const configSearchPaths = [
    join(process.cwd(), '..', 'dashaws.config.json'),
    join(process.cwd(), 'dashaws.config.json'),
];
for (const p of configSearchPaths) {
    try {
        if (existsSync(p)) {
            const config = JSON.parse(readFileSync(p, 'utf-8'));
            serverPassword = config.password || null;
            if (serverPassword) {
                console.log('[auth] Password loaded from config file');
                break;
            }
        }
    }
    catch { /* ignore */ }
}
const validTokens = new Set();
const authEnabled = serverPassword !== null;
if (!authEnabled) {
    console.log('[auth] No password configured — authentication disabled');
}
const failedAttempts = new Map();
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
}
function calculateBackoff(count) {
    return Math.min(Math.pow(2, count - 1), 300) * 1000;
}
function checkRateLimit(ip) {
    const entry = failedAttempts.get(ip);
    if (!entry)
        return null;
    const backoffMs = calculateBackoff(entry.count);
    const elapsed = Date.now() - entry.lastAttempt;
    if (elapsed < backoffMs) {
        return backoffMs - elapsed;
    }
    return null;
}
function recordFailedAttempt(ip) {
    const existing = failedAttempts.get(ip);
    if (existing) {
        existing.count += 1;
        existing.lastAttempt = Date.now();
    }
    else {
        failedAttempts.set(ip, {
            count: 1,
            lastAttempt: Date.now(),
            firstAttempt: Date.now(),
        });
    }
}
function clearFailedAttempts(ip) {
    failedAttempts.delete(ip);
}
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [ip, entry] of failedAttempts) {
        if (entry.firstAttempt < cutoff) {
            failedAttempts.delete(ip);
        }
    }
}, 60 * 1000);
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
app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/auth/login' || req.path === '/auth/status') {
        return next();
    }
    if (!authEnabled) {
        return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7);
    if (!validTokens.has(token)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next();
});
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
    const token = randomBytes(32).toString('hex');
    validTokens.add(token);
    setTimeout(() => validTokens.delete(token), 24 * 60 * 60 * 1000);
    res.json({ token });
});
app.get('/api/auth/status', (_req, res) => {
    res.json({ authEnabled });
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