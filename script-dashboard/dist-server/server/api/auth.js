import { randomBytes, timingSafeEqual } from 'crypto';
export const COOKIE_NAME = 'dashaws_token';
export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const validTokens = new Set();
export let authEnabled = false;
export let serverPassword = null;
export const failedAttempts = new Map();
export function setPassword(pw) {
    serverPassword = pw;
    authEnabled = pw !== null;
}
export function verifyPassword(input) {
    if (!serverPassword)
        return false;
    const inputBuf = Buffer.from(input, 'utf-8');
    const storedBuf = Buffer.from(serverPassword, 'utf-8');
    if (inputBuf.length !== storedBuf.length) {
        // Compare anyway to avoid length-based timing leak
        const dummy = Buffer.alloc(storedBuf.length, 0);
        inputBuf.copy(dummy);
        void timingSafeEqual(dummy, storedBuf);
        return false;
    }
    return timingSafeEqual(inputBuf, storedBuf);
}
export function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader)
        return cookies;
    cookieHeader.split(';').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > 0) {
            cookies[pair.substring(0, idx).trim()] = pair.substring(idx + 1).trim();
        }
    });
    return cookies;
}
export function setAuthCookie(res, token) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(TOKEN_MAX_AGE_MS / 1000)}`);
}
export function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}
export function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        return cookies[COOKIE_NAME] || null;
    }
    return null;
}
export function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
}
export function calculateBackoff(count) {
    return Math.min(Math.pow(2, count - 1), 300) * 1000;
}
export function checkRateLimit(ip) {
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
export function recordFailedAttempt(ip) {
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
export function clearFailedAttempts(ip) {
    failedAttempts.delete(ip);
}
export function cleanupFailedAttempts(maxAgeMs = 10 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [ip, entry] of failedAttempts) {
        if (entry.firstAttempt < cutoff) {
            failedAttempts.delete(ip);
        }
    }
}
export function createToken() {
    const token = randomBytes(32).toString('hex');
    validTokens.add(token);
    setTimeout(() => validTokens.delete(token), TOKEN_MAX_AGE_MS);
    return token;
}
export function removeToken(token) {
    validTokens.delete(token);
}
export function resetAuthState() {
    validTokens.clear();
    failedAttempts.clear();
    authEnabled = false;
    serverPassword = null;
}
export function createAuthMiddleware() {
    return (req, res, next) => {
        if (req.path === '/health' || req.path === '/auth/login' || req.path === '/auth/status') {
            return next();
        }
        if (!authEnabled) {
            return next();
        }
        const token = extractToken(req);
        if (!token || !validTokens.has(token)) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map