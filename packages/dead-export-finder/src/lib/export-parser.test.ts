import { it } from '@effect/vitest';
import { expect } from 'vitest';
import { Effect } from 'effect';
import { ExportParser, ExportParserLive } from './export-parser.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const parse = (filePath: string, source: string) =>
  Effect.gen(function* () {
    const parser = yield* ExportParser;
    return yield* parser.parse(filePath, source);
  }).pipe(Effect.provide(ExportParserLive));

// ─── tests ────────────────────────────────────────────────────────────────────

it.effect('parses named export declarations', () =>
  Effect.gen(function* () {
    const source = 'export const foo = 1; export function bar() {} export class Baz {}';
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(3);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
    expect(names).toContain('Baz');
    for (const s of symbols) {
      expect(s.isDefault).toBe(false);
      expect(s.isReExport).toBe(false);
    }
  }),
);

it.effect('parses default export', () =>
  Effect.gen(function* () {
    const source = 'export default function main() {}';
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('default');
    expect(symbols[0]?.isDefault).toBe(true);
    expect(symbols[0]?.isReExport).toBe(false);
  }),
);

it.effect('parses re-exports', () =>
  Effect.gen(function* () {
    const source = "export { foo, bar } from './other'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(2);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
    for (const s of symbols) {
      expect(s.isReExport).toBe(true);
      expect(s.reExportSource).toBe('./other');
    }
  }),
);

it.effect('parses export star', () =>
  Effect.gen(function* () {
    const source = "export * from './utils'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('*');
    expect(symbols[0]?.isReExport).toBe(true);
    expect(symbols[0]?.reExportSource).toBe('./utils');
  }),
);

it.effect('parses export list from local bindings', () =>
  Effect.gen(function* () {
    const source = 'const x = 1; export { x, y }';
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(2);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('x');
    expect(names).toContain('y');
    for (const s of symbols) {
      expect(s.isReExport).toBe(false);
    }
  }),
);

it.effect('parses CJS module.exports', () =>
  Effect.gen(function* () {
    const source = 'module.exports = { foo, bar }';
    const symbols = yield* parse('test.js', source);
    expect(symbols).toHaveLength(2);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
  }),
);

it.effect('parses CJS exports.name', () =>
  Effect.gen(function* () {
    const source = 'exports.foo = function() {}; exports.bar = 42';
    const symbols = yield* parse('test.js', source);
    expect(symbols).toHaveLength(2);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
  }),
);

it.effect('parses type exports', () =>
  Effect.gen(function* () {
    const source = 'export type Foo = string; export interface Bar {}';
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(2);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('Foo');
    expect(names).toContain('Bar');
  }),
);
