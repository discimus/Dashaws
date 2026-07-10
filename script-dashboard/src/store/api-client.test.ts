import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from './api-client';

function mockFetch(response: Partial<Response> & { _body?: unknown }) {
  const res = {
    ok: true,
    status: 200,
    json: async () => response._body ?? {},
    headers: new Headers(response.headers || {}),
    ...response,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
  return vi.mocked(globalThis.fetch);
}

function mockFetchReject(error: Error) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiClient auth', () => {
  describe('login', () => {
    it('returns token on successful login', async () => {
      const client = new ApiClient('/api');
      const fetchFn = mockFetch({ ok: true, _body: { token: 'abc123' } });

      const result = await client.login('correct-password');

      expect(result).toEqual({ token: 'abc123' });
      expect(fetchFn).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'correct-password' }),
      });
    });

    it('throws on wrong password', async () => {
      const client = new ApiClient('/api');
      mockFetch({ ok: false, status: 401, _body: { error: 'Invalid password' } });

      await expect(client.login('wrong')).rejects.toThrow('Invalid password');
    });

    it('throws with retryAfter on 429 rate limit', async () => {
      const client = new ApiClient('/api');
      mockFetch({ ok: false, status: 429, _body: { retryAfter: 5000, attempts: 3 } });

      try {
        await client.login('password');
      } catch (err: unknown) {
        const e = err as Error & { retryAfter: number; attempts: number };
        expect(e.message).toBe('Too many attempts');
        expect(e.retryAfter).toBe(5000);
        expect(e.attempts).toBe(3);
      }
    });
  });

  describe('verifyAuth', () => {
    it('returns true when authenticated (cookie or token)', async () => {
      const client = new ApiClient('/api');
      client.setToken('valid-token');
      mockFetch({ ok: true, _body: { authenticated: true } });

      const result = await client.verifyAuth();

      expect(result).toBe(true);
    });

    it('returns false when not authenticated', async () => {
      const client = new ApiClient('/api');
      mockFetch({ ok: false, status: 401, _body: { error: 'Authentication required' } });

      const result = await client.verifyAuth();

      expect(result).toBe(false);
    });

    it('sends bearer token in Authorization header', async () => {
      const client = new ApiClient('/api');
      client.setToken('my-token');
      const fetchFn = mockFetch({ ok: true, _body: { authenticated: true } });

      await client.verifyAuth();

      const callHeaders = fetchFn.mock.calls[0][1]?.headers as Record<string, string> | undefined;
      expect(callHeaders?.['Authorization']).toBe('Bearer my-token');
    });
  });

  describe('logout', () => {
    it('clears token and calls logout endpoint', async () => {
      const client = new ApiClient('/api');
      client.setToken('my-token');
      const fetchFn = mockFetch({ ok: true, _body: { ok: true } });

      await client.logout();

      expect(client.getToken()).toBeNull();
      expect(fetchFn).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('getAuthStatus', () => {
    it('returns authEnabled from server', async () => {
      const client = new ApiClient('/api');
      mockFetch({ ok: true, _body: { authEnabled: true } });

      const result = await client.getAuthStatus();

      expect(result).toEqual({ authEnabled: true });
    });

    it('returns false when endpoint fails', async () => {
      const client = new ApiClient('/api');
      mockFetchReject(new Error('Network error'));

      const result = await client.getAuthStatus();

      expect(result).toEqual({ authEnabled: false });
    });
  });

  describe('setToken / getToken', () => {
    it('stores and retrieves token', () => {
      const client = new ApiClient('/api');
      expect(client.getToken()).toBeNull();

      client.setToken('abc');
      expect(client.getToken()).toBe('abc');

      client.setToken(null);
      expect(client.getToken()).toBeNull();
    });
  });

  describe('onAuthError callback', () => {
    it('calls callback when 401 received', async () => {
      const client = new ApiClient('/api');
      client.setToken('expired-token');
      const cb = vi.fn();
      client.setOnAuthError(cb);
      mockFetch({ ok: false, status: 401, _body: { error: 'Invalid or expired token' } });

      await expect(client.verifyAuth()).resolves.toBe(false);
      expect(cb).toHaveBeenCalledOnce();
      expect(client.getToken()).toBeNull();
    });
  });

  describe('token in requests', () => {
    it('includes Authorization header on protected endpoints', async () => {
      const client = new ApiClient('/api');
      client.setToken('bearer-token');
      const fetchFn = mockFetch({ ok: true, _body: [] });

      await client.list();

      const callHeaders = (fetchFn.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string> | undefined;
      expect(callHeaders?.['Authorization']).toBe('Bearer bearer-token');
    });

    it('does not include Authorization when no token set', async () => {
      const client = new ApiClient('/api');
      const fetchFn = mockFetch({ ok: true, _body: [] });

      await client.list();

      const callHeaders = (fetchFn.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string> | undefined;
      expect(callHeaders?.['Authorization']).toBeUndefined();
    });
  });
});
