import { describe, it, expect } from 'vitest';
import { findSnippetLocation } from './snippet-match.js';

describe('findSnippetLocation', () => {
  const source = [
    'import { foo } from "bar";',
    '',
    'const x = createStore();',
    '',
    'export { x };',
  ].join('\n');

  it('finds a snippet and returns the correct line/column', () => {
    const result = findSnippetLocation(source, 'createStore()');
    expect(result).toEqual({ line: 3, column: 10 });
  });

  it('returns null when snippet is not found', () => {
    const result = findSnippetLocation(source, 'notInSource()');
    expect(result).toBeNull();
  });

  it('finds snippet on the first line', () => {
    const result = findSnippetLocation(source, 'import');
    expect(result).toEqual({ line: 1, column: 0 });
  });

  it('handles multi-line snippets by matching the first line', () => {
    const multiLine = 'const x = createStore();\n\nexport { x };';
    const result = findSnippetLocation(source, multiLine);
    expect(result).toEqual({ line: 3, column: 0 });
  });

  it('returns null for empty snippet', () => {
    const result = findSnippetLocation(source, '');
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only snippet', () => {
    const result = findSnippetLocation(source, '   \n  ');
    expect(result).toBeNull();
  });
});
