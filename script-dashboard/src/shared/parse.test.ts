import { describe, it, expect } from 'vitest';
import { parseParams, parseMessageBody } from './parse';

describe('parseParams', () => {
  it('returns empty object for empty string', () => {
    expect(parseParams('')).toEqual({});
  });

  it('parses valid JSON', () => {
    expect(parseParams('{"key":"val"}')).toEqual({ key: 'val' });
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseParams('{invalid}')).toEqual({});
  });

  it('returns empty object for JSON array', () => {
    expect(parseParams('[1,2,3]')).toEqual({});
  });

  it('returns empty object for JSON literal', () => {
    expect(parseParams('"hello"')).toEqual({});
  });

  it('returns empty object for a number', () => {
    expect(parseParams('42')).toEqual({});
  });
});

describe('parseMessageBody', () => {
  it('parses JSON object directly', () => {
    expect(parseMessageBody('{"key":"val"}')).toEqual({ key: 'val' });
  });

  it('wraps plain string in {message: body}', () => {
    expect(parseMessageBody('hello')).toEqual({ message: 'hello' });
  });

  it('wraps invalid JSON in {message: body}', () => {
    expect(parseMessageBody('{broken')).toEqual({ message: '{broken' });
  });

  it('wraps JSON array in {message: body}', () => {
    expect(parseMessageBody('[1,2]')).toEqual({ message: '[1,2]' });
  });

  it('wraps JSON literal in {message: body}', () => {
    expect(parseMessageBody('42')).toEqual({ message: '42' });
  });
});
