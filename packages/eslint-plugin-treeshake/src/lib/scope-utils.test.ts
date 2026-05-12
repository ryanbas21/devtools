import { describe, it, expect } from 'vitest';
import type { TSESTree } from '@typescript-eslint/utils';
import { getCalleeName } from './scope-utils.js';

describe('getCalleeName', () => {
  it('returns name for simple identifier', () => {
    const node = { type: 'Identifier', name: 'foo' } as unknown as TSESTree.Expression;
    expect(getCalleeName(node)).toBe('foo');
  });

  it('returns dotted name for member expression', () => {
    const node = {
      type: 'MemberExpression',
      computed: false,
      object: { type: 'Identifier', name: 'Object' },
      property: { type: 'Identifier', name: 'freeze' },
    } as unknown as TSESTree.Expression;
    expect(getCalleeName(node)).toBe('Object.freeze');
  });

  it('returns null for computed member expression', () => {
    const node = {
      type: 'MemberExpression',
      computed: true,
      object: { type: 'Identifier', name: 'obj' },
      property: { type: 'Literal', value: 'foo' },
    } as unknown as TSESTree.Expression;
    expect(getCalleeName(node)).toBeNull();
  });

  it('returns null for complex callee', () => {
    const node = {
      type: 'MemberExpression',
      computed: false,
      object: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'getObj' },
        arguments: [],
      },
      property: { type: 'Identifier', name: 'method' },
    } as unknown as TSESTree.Expression;
    expect(getCalleeName(node)).toBeNull();
  });
});
