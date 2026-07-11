import { describe, it, expect } from 'vitest';
import { formatValue } from './format-value';

describe('formatValue', () => {
  it('returns string unchanged', () => {
    expect(formatValue('hello')).toBe('hello');
  });

  it('converts object to indented JSON', () => {
    expect(formatValue({ a: 1, b: 2 })).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('returns "null" for null', () => {
    expect(formatValue(null)).toBe('null');
  });

  it('returns "undefined" for undefined', () => {
    expect(formatValue(undefined)).toBe('undefined');
  });

  it('falls back to String() for circular objects', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    const result = formatValue(obj);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
