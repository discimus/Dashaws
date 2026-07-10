import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCookies,
  extractToken,
  calculateBackoff,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  cleanupFailedAttempts,
  failedAttempts,
  validTokens,
  authEnabled,
  setPassword,
  createToken,
  removeToken,
  resetAuthState,
  COOKIE_NAME,
} from '../api/auth';

function makeReq(opts: {
  authorization?: string;
  cookie?: string;
  ip?: string;
  path?: string;
}): Parameters<typeof extractToken>[0] {
  return {
    headers: {
      authorization: opts.authorization,
      cookie: opts.cookie,
      'x-forwarded-for': opts.ip,
    } as Record<string, string | undefined>,
    socket: { remoteAddress: opts.ip } as unknown as Parameters<typeof extractToken>[0]['socket'],
    path: opts.path || '/',
  } as unknown as Parameters<typeof extractToken>[0];
}

describe('parseCookies', () => {
  it('parses a single cookie', () => {
    const result = parseCookies('token=abc123');
    expect(result).toEqual({ token: 'abc123' });
  });

  it('parses multiple cookies', () => {
    const result = parseCookies('token=abc; user=john; dashaws_token=xyz789');
    expect(result).toEqual({
      token: 'abc',
      user: 'john',
      dashaws_token: 'xyz789',
    });
  });

  it('returns empty object for empty string', () => {
    expect(parseCookies('')).toEqual({});
  });

  it('handles cookies with spaces', () => {
    const result = parseCookies(' token = abc ; dashaws_token = xyz ');
    expect(result).toEqual({ token: 'abc', dashaws_token: 'xyz' });
  });

  it('handles cookie value with = sign', () => {
    const result = parseCookies('token=abc=def');
    expect(result).toEqual({ token: 'abc=def' });
  });
});

describe('extractToken', () => {
  it('extracts from Authorization Bearer header', () => {
    const req = makeReq({ authorization: 'Bearer my-token-123' });
    expect(extractToken(req)).toBe('my-token-123');
  });

  it('extracts from cookie', () => {
    const req = makeReq({ cookie: `${COOKIE_NAME}=cookie-token-456` });
    expect(extractToken(req)).toBe('cookie-token-456');
  });

  it('prefers Authorization header over cookie', () => {
    const req = makeReq({
      authorization: 'Bearer header-token',
      cookie: `${COOKIE_NAME}=cookie-token`,
    });
    expect(extractToken(req)).toBe('header-token');
  });

  it('returns null when no auth present', () => {
    const req = makeReq({});
    expect(extractToken(req)).toBeNull();
  });

  it('returns null when Authorization is not Bearer', () => {
    const req = makeReq({ authorization: 'Basic abc' });
    expect(extractToken(req)).toBeNull();
  });

  it('returns null when cookie exists but not dashaws_token', () => {
    const req = makeReq({ cookie: 'other-cookie=value' });
    expect(extractToken(req)).toBeNull();
  });
});

describe('calculateBackoff', () => {
  it('returns 0ms for count 1 (2^0 * 1000)', () => {
    expect(calculateBackoff(1)).toBe(1000);
  });

  it('returns 2000ms for count 2 (2^1 * 1000)', () => {
    expect(calculateBackoff(2)).toBe(2000);
  });

  it('returns 4000ms for count 3', () => {
    expect(calculateBackoff(3)).toBe(4000);
  });

  it('returns 8000ms for count 4', () => {
    expect(calculateBackoff(4)).toBe(8000);
  });

  it('caps at 300 seconds (300,000ms)', () => {
    expect(calculateBackoff(20)).toBe(300000);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    failedAttempts.clear();
  });

  it('returns null when no previous attempts', () => {
    expect(checkRateLimit('1.2.3.4')).toBeNull();
  });

  it('returns remaining backoff time when rate limited', () => {
    recordFailedAttempt('1.2.3.4'); // count=1, backoff=1000ms
    const result = checkRateLimit('1.2.3.4');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1000);
  });

  it('returns null when backoff period has elapsed', () => {
    const ip = '5.6.7.8';
    recordFailedAttempt(ip); // count=1
    // Simulate elapsed time
    const entry = failedAttempts.get(ip)!;
    entry.lastAttempt = Date.now() - 2000;
    expect(checkRateLimit(ip)).toBeNull();
  });

  it('increases backoff with each failed attempt', () => {
    const ip = '10.0.0.1';
    recordFailedAttempt(ip);
    recordFailedAttempt(ip);
    recordFailedAttempt(ip);
    // count=3, backoff=4s
    const backoff = checkRateLimit(ip);
    expect(backoff).toBeGreaterThan(0);
    expect(backoff).toBeLessThanOrEqual(4000);
  });
});

describe('failedAttempts tracking', () => {
  beforeEach(() => {
    failedAttempts.clear();
  });

  it('records first attempt with count 1', () => {
    recordFailedAttempt('1.1.1.1');
    expect(failedAttempts.get('1.1.1.1')).toMatchObject({ count: 1 });
  });

  it('increments count on subsequent attempts', () => {
    recordFailedAttempt('2.2.2.2');
    recordFailedAttempt('2.2.2.2');
    expect(failedAttempts.get('2.2.2.2')!.count).toBe(2);
  });

  it('updates lastAttempt timestamp', () => {
    recordFailedAttempt('3.3.3.3');
    const firstTimestamp = failedAttempts.get('3.3.3.3')!.lastAttempt;
    recordFailedAttempt('3.3.3.3');
    const secondTimestamp = failedAttempts.get('3.3.3.3')!.lastAttempt;
    expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
  });

  it('clearFailedAttempts removes entry', () => {
    recordFailedAttempt('4.4.4.4');
    clearFailedAttempts('4.4.4.4');
    expect(failedAttempts.has('4.4.4.4')).toBe(false);
  });

  it('cleanupFailedAttempts removes old entries', () => {
    recordFailedAttempt('5.5.5.5');
    const entry = failedAttempts.get('5.5.5.5')!;
    entry.firstAttempt = Date.now() - 11 * 60 * 1000; // 11 minutes ago

    cleanupFailedAttempts(10 * 60 * 1000);
    expect(failedAttempts.has('5.5.5.5')).toBe(false);
  });

  it('cleanupFailedAttempts keeps recent entries', () => {
    recordFailedAttempt('6.6.6.6');
    cleanupFailedAttempts(10 * 60 * 1000);
    expect(failedAttempts.has('6.6.6.6')).toBe(true);
  });
});

describe('token management', () => {
  beforeEach(() => {
    validTokens.clear();
  });

  it('createToken adds to validTokens', () => {
    const token = createToken();
    expect(validTokens.has(token)).toBe(true);
    expect(token).toHaveLength(64); // hex string
  });

  it('removeToken removes from validTokens', () => {
    const token = createToken();
    removeToken(token);
    expect(validTokens.has(token)).toBe(false);
  });

  it('removeToken is safe for non-existent token', () => {
    removeToken('non-existent');
    expect(validTokens.size).toBe(0);
  });
});

describe('setPassword', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('enables auth when password is set', () => {
    expect(authEnabled).toBe(false);
    setPassword('secret');
    expect(authEnabled).toBe(true);
  });

  it('disables auth when password is null', () => {
    setPassword('secret');
    setPassword(null);
    expect(authEnabled).toBe(false);
  });
});

describe('resetAuthState', () => {
  it('clears all auth state', () => {
    setPassword('test');
    createToken();
    recordFailedAttempt('1.2.3.4');

    resetAuthState();

    expect(authEnabled).toBe(false);
    expect(validTokens.size).toBe(0);
    expect(failedAttempts.size).toBe(0);
  });
});
