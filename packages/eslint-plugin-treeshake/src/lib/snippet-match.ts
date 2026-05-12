export interface SourceLocation {
  /** 1-based line number */
  readonly line: number;
  /** 0-based column offset */
  readonly column: number;
}

/**
 * Find where a code snippet appears in a source string.
 * For multi-line snippets, matches the first non-empty line of the snippet.
 * Returns null if not found or snippet is empty/whitespace.
 */
export const findSnippetLocation = (source: string, snippet: string): SourceLocation | null => {
  const trimmed = snippet.trim();
  if (trimmed.length === 0) return null;

  const firstLine = trimmed.split('\n').find((l) => l.trim().length > 0);
  if (!firstLine) return null;

  const searchTarget = firstLine.trim();
  const index = source.indexOf(searchTarget);
  if (index === -1) return null;

  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  const column = lastNewline === -1 ? index : index - lastNewline - 1;

  return { line, column };
};
