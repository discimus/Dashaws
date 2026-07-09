import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

let server: http.Server;
let baseUrl: string;

async function startTestServer(): Promise<string> {
  const express = (await import('express')).default;
  const auth = await import('../api/auth');
  const { createApiRouter: createAppRouter } = await import('./routes');
  const { initServerState } = await import('./state');

  auth.resetAuthState();
  auth.setPassword('test-password');
  initServerState();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.use('/api', auth.createAuthMiddleware());

  app.post('/api/auth/login', (req: any, res: any) => {
    if (!auth.authEnabled) {
      return res.json({ token: 'no-auth-required' });
    }

    const ip = auth.getClientIP(req);
    const retryAfter = auth.checkRateLimit(ip);
    if (retryAfter !== null) {
      return res.status(429).json({
        error: 'Too many attempts.',
        retryAfter,
        attempts: auth.failedAttempts.get(ip)!.count,
      });
    }

    const { password } = req.body || {};
    if (!password || password !== auth.serverPassword) {
      auth.recordFailedAttempt(ip);
      return res.status(401).json({
        error: 'Invalid password',
        attempts: auth.failedAttempts.get(ip)!.count,
      });
    }

    auth.clearFailedAttempts(ip);
    const token = auth.createToken();
    auth.setAuthCookie(res, token);
    res.json({ token });
  });

  app.get('/api/auth/status', (_req: any, res: any) => {
    res.json({ authEnabled: auth.authEnabled });
  });

  app.get('/api/auth/verify', (_req: any, res: any) => {
    res.json({ authenticated: true });
  });

  app.post('/api/auth/logout', (req: any, res: any) => {
    const token = auth.extractToken(req);
    if (token) auth.removeToken(token);
    auth.clearAuthCookie(res);
    res.json({ ok: true });
  });

  app.use('/api', createAppRouter());

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve(`http://localhost:${port}`);
    });
  });
}

function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

beforeEach(async () => {
  baseUrl = await startTestServer();
});

afterEach(async () => {
  await stopTestServer();
});

describe('Auth API integration', () => {
  describe('POST /api/auth/login', () => {
    it('returns token on correct password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeTruthy();
      expect(data.token).toHaveLength(64);
    });

    it('returns 401 on wrong password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Invalid password');
    });

    it('sets cookie on successful login', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('dashaws_token=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
    });

    it('returns 429 after a failed attempt (rate-limited within backoff)', async () => {
      await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      });

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.retryAfter).toBeGreaterThan(0);
      expect(data.attempts).toBe(1);
    });

    it('correct password clears rate limit', async () => {
      await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      });

      // Wait past the 1s backoff, then correct password clears
      await new Promise(r => setTimeout(r, 1100));

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toHaveLength(64);
    });
  });

  describe('GET /api/auth/status', () => {
    it('returns authEnabled true', async () => {
      const res = await fetch(`${baseUrl}/api/auth/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authEnabled).toBe(true);
    });

    it('does not require authentication', async () => {
      const res = await fetch(`${baseUrl}/api/auth/status`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('returns 401 without auth', async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with valid Bearer token', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      const { token } = await loginRes.json();

      const res = await fetch(`${baseUrl}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
    });

    it('returns 200 with valid cookie', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      const setCookie = loginRes.headers.get('set-cookie');
      const cookieValue = setCookie?.split(';')[0];

      const res = await fetch(`${baseUrl}/api/auth/verify`, {
        headers: { Cookie: cookieValue! },
      });

      expect(res.status).toBe(200);
    });

    it('returns 401 with invalid token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify`, {
        headers: { Authorization: 'Bearer fake-token' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('invalidates token and clears cookie', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      const { token } = await loginRes.json();

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(logoutRes.status).toBe(200);
      const data = await logoutRes.json();
      expect(data.ok).toBe(true);

      const setCookie = logoutRes.headers.get('set-cookie');
      expect(setCookie).toContain('dashaws_token=;');

      const verifyRes = await fetch(`${baseUrl}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(verifyRes.status).toBe(401);
    });

    it('works with cookie-based auth for logout', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      const setCookie = loginRes.headers.get('set-cookie');
      const cookieValue = setCookie?.split(';')[0];

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookieValue! },
      });
      expect(logoutRes.status).toBe(200);
    });
  });

  describe('Protected endpoints', () => {
    it('returns 401 without auth', async () => {
      const res = await fetch(`${baseUrl}/api/cells`);
      expect(res.status).toBe(401);
    });

    it('allows access with valid token', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      const { token } = await loginRes.json();

      const res = await fetch(`${baseUrl}/api/cells`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    });

    it('allows access with valid cookie', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test-password' }),
      });
      const setCookie = loginRes.headers.get('set-cookie');
      const cookieValue = setCookie?.split(';')[0];

      const res = await fetch(`${baseUrl}/api/cells`, {
        headers: { Cookie: cookieValue! },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('No auth mode', () => {
    it('returns no-auth-required token when auth is disabled', async () => {
      const auth = await import('../api/auth');
      auth.resetAuthState();
      auth.setPassword(null);

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'anything' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBe('no-auth-required');
    });
  });
});
