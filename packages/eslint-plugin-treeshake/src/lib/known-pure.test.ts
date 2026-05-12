import { describe, it, expect } from 'vitest';
import { isKnownPure, KNOWN_PURE_CALLS } from './known-pure.js';

describe('isKnownPure', () => {
  it('recognizes Object.freeze as pure', () => {
    expect(isKnownPure('Object.freeze')).toBe(true);
  });

  it('recognizes Symbol.for as pure', () => {
    expect(isKnownPure('Symbol.for')).toBe(true);
  });

  it('rejects unknown functions', () => {
    expect(isKnownPure('initializeGlobals')).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isKnownPure('Object')).toBe(false);
  });

  it('accepts user-provided additional pure functions', () => {
    expect(isKnownPure('myPureHelper', ['myPureHelper'])).toBe(true);
  });

  it('does not accept user-provided functions without passing them', () => {
    expect(isKnownPure('myPureHelper')).toBe(false);
  });
});

describe('KNOWN_PURE_CALLS', () => {
  it('contains expected built-in entries', () => {
    expect(KNOWN_PURE_CALLS.has('Object.freeze')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Object.create')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Array.from')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Symbol')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Symbol.for')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('JSON.parse')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('JSON.stringify')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Promise.resolve')).toBe(true);
  });
});
