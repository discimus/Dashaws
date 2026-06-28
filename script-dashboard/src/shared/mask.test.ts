import { describe, it, expect } from 'vitest';
import { maskValue, maskState, maskArgs } from './mask';

describe('maskValue', () => {
  it('masks exact secret in a string', () => {
    const result = maskValue('helloSecretWorld', new Set(['Secret']));
    expect(result).toBe('hello\u2022\u2022\u2022\u2022\u2022\u2022World');
  });

  it('masks multiple occurrences in the same string', () => {
    const result = maskValue('abab', new Set(['a']));
    expect(result).toBe('\u2022\u2022\u2022\u2022\u2022\u2022b\u2022\u2022\u2022\u2022\u2022\u2022b');
  });

  it('recursively masks array elements', () => {
    const result = maskValue(['secret', { key: 'secret' }], new Set(['secret']));
    expect(result).toEqual(['\u2022\u2022\u2022\u2022\u2022\u2022', { key: '\u2022\u2022\u2022\u2022\u2022\u2022' }]);
  });

  it('recursively masks object properties', () => {
    const result = maskValue(
      { a: 'prefix_secret', b: { c: 'secret_suffix' } },
      new Set(['secret'])
    );
    expect(result).toEqual({
      a: 'prefix_\u2022\u2022\u2022\u2022\u2022\u2022',
      b: { c: '\u2022\u2022\u2022\u2022\u2022\u2022_suffix' },
    });
  });

  it('returns primitives unchanged', () => {
    expect(maskValue(42, new Set(['x']))).toBe(42);
    expect(maskValue(null, new Set(['x']))).toBe(null);
    expect(maskValue(true, new Set(['x']))).toBe(true);
    expect(maskValue(undefined, new Set(['x']))).toBe(undefined);
  });

  it('returns value unchanged when secrets set is empty', () => {
    expect(maskValue('hello', new Set())).toBe('hello');
    expect(maskValue({ key: 'val' }, new Set())).toEqual({ key: 'val' });
  });

  it('does not mutate the original object', () => {
    const original = { a: 'hello' };
    const result = maskValue(original, new Set(['hello']));
    expect(original.a).toBe('hello');
    expect(result).not.toBe(original);
  });
});

describe('maskState', () => {
  it('returns a new object without mutating the original', () => {
    const original = { a: 'secret' };
    const result = maskState(original, new Set(['secret']));
    expect(original.a).toBe('secret');
    expect(result.a).toBe('\u2022\u2022\u2022\u2022\u2022\u2022');
    expect(result).not.toBe(original);
  });

  it('masks all values in the state', () => {
    const state = { key1: 'secret_a', key2: 'secret_b' };
    const result = maskState(state, new Set(['a', 'b']));
    expect(result.key1).not.toContain('a');
    expect(result.key2).not.toContain('b');
  });

  it('returns the same state object when secrets is empty', () => {
    const state = { key: 'val' };
    const result = maskState(state, new Set());
    expect(result).toBe(state);
  });
});

describe('maskArgs', () => {
  it('returns args unchanged when secrets is empty', () => {
    const args = ['hello', 42];
    const result = maskArgs(args, new Set());
    expect(result).toBe(args);
  });

  it('masks secret values in args', () => {
    const args = ['the secret is here', { nested: 'secret too' }];
    const result = maskArgs(args, new Set(['secret']));
    expect(result[0]).not.toContain('secret');
    expect((result[1] as Record<string, unknown>).nested).not.toBe('secret too');
  });
});
