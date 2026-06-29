import { describe, it, expect } from 'vitest';
import { stripConstructors } from './strip-constructors';

describe('stripConstructors', () => {
  it('removes constructor from Array', () => {
    stripConstructors();
    expect((Array as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Object', () => {
    stripConstructors();
    expect((Object as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from String', () => {
    stripConstructors();
    expect((String as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Number', () => {
    stripConstructors();
    expect((Number as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Boolean', () => {
    stripConstructors();
    expect((Boolean as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from RegExp', () => {
    stripConstructors();
    expect((RegExp as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Map', () => {
    stripConstructors();
    expect((Map as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Set', () => {
    stripConstructors();
    expect((Set as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Error', () => {
    stripConstructors();
    expect((Error as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('removes constructor from Date', () => {
    stripConstructors();
    expect((Date as unknown as Record<string, unknown>).constructor).toBeUndefined();
  });

  it('returns stripped constructors object', () => {
    const result = stripConstructors();
    expect(result.Array).toBe(Array);
    expect(result.Object).toBe(Object);
    expect(result.String).toBe(String);
    expect(result.Number).toBe(Number);
    expect(result.Boolean).toBe(Boolean);
    expect(result.RegExp).toBe(RegExp);
    expect(result.Map).toBe(Map);
    expect(result.Set).toBe(Set);
    expect(result.Promise).toBe(Promise);
    expect(result.ErrorConstructor).toBe(Error);
    expect(result.Date).toBe(Date);
  });

  it('is idempotent — calling twice does not throw', () => {
    stripConstructors();
    expect(() => stripConstructors()).not.toThrow();
  });
});
