import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLoadPackage, clearPackageCache, resolveUrl } from './load-package';

beforeEach(() => {
  clearPackageCache();
  vi.restoreAllMocks();
});

describe('resolveUrl', () => {
  it('builds esm.sh URL', () => {
    expect(resolveUrl('lodash@4')).toBe('https://esm.sh/lodash@4');
  });

  it('handles scoped packages', () => {
    expect(resolveUrl('@scope/pkg@1.0.0')).toBe('https://esm.sh/@scope/pkg@1.0.0');
  });
});

describe('createLoadPackage', () => {
  it('returns cached module without re-importing', async () => {
    const mockMod = { default: () => 'hello' };
    const importFn = vi.fn().mockResolvedValue(mockMod);
    const loadPackage = createLoadPackage(importFn);

    const a = await loadPackage('my-pkg@1');
    const b = await loadPackage('my-pkg@1');

    expect(a).toBe(mockMod);
    expect(b).toBe(mockMod);
    expect(a).toBe(b);
    expect(importFn).toHaveBeenCalledTimes(1);
    expect(importFn).toHaveBeenCalledWith(resolveUrl('my-pkg@1'));
  });

  it('propagates import errors with a clear message', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('Failed to fetch dynamically imported module'));
    const loadPackage = createLoadPackage(importFn);

    await expect(loadPackage('bad-pkg@1')).rejects.toThrow(
      'loadPackage("bad-pkg@1"): Failed to fetch dynamically imported module'
    );
  });

  it('wraps non-Error rejections', async () => {
    const importFn = vi.fn().mockRejectedValue('some string error');
    const loadPackage = createLoadPackage(importFn);

    await expect(loadPackage('pkg@1')).rejects.toThrow(
      'loadPackage("pkg@1"): some string error'
    );
  });

  it('uses separate caches for different specs', async () => {
    const calls: string[] = [];
    const importFn = vi.fn().mockImplementation(() => {
      calls.push('call');
      return Promise.resolve({ default: calls.length === 1 ? 'lodash' : 'dayjs' });
    });

    const loadPackage = createLoadPackage(importFn);

    const lodash = await loadPackage('lodash@4');
    const dayjs = await loadPackage('dayjs');

    expect(lodash).toEqual({ default: 'lodash' });
    expect(dayjs).toEqual({ default: 'dayjs' });
    expect(importFn).toHaveBeenCalledTimes(2);
  });

  it('calls importFn with the resolved esm.sh URL', async () => {
    const importFn = vi.fn().mockResolvedValue({ default: 42 });
    const loadPackage = createLoadPackage(importFn);

    await loadPackage('react@18');

    expect(importFn).toHaveBeenCalledWith('https://esm.sh/react@18');
  });
});
