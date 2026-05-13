import { it } from '@effect/vitest';
import { expect } from 'vitest';
import { Effect } from 'effect';
import { ImportParser, ImportParserLive } from './import-parser.js';
import { ParseError } from './errors.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const parse = (filePath: string, source: string) =>
  Effect.gen(function* () {
    const parser = yield* ImportParser;
    return yield* parser.parse(filePath, source);
  }).pipe(Effect.provide(ImportParserLive));

// ─── tests ────────────────────────────────────────────────────────────────────

it.effect('parses named imports', () =>
  Effect.gen(function* () {
    const source = "import { foo, bar } from '@myorg/utils'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(2);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
    for (const s of symbols) {
      expect(s.source).toBe('@myorg/utils');
      expect(s.isNamespace).toBe(false);
      expect(s.isDynamic).toBe(false);
    }
  }),
);

it.effect('parses default import', () =>
  Effect.gen(function* () {
    const source = "import foo from '@myorg/utils'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('default');
    expect(symbols[0]?.source).toBe('@myorg/utils');
    expect(symbols[0]?.isNamespace).toBe(false);
    expect(symbols[0]?.isDynamic).toBe(false);
  }),
);

it.effect('parses namespace import', () =>
  Effect.gen(function* () {
    const source = "import * as utils from '@myorg/utils'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('*');
    expect(symbols[0]?.source).toBe('@myorg/utils');
    expect(symbols[0]?.isNamespace).toBe(true);
    expect(symbols[0]?.isDynamic).toBe(false);
  }),
);

it.effect('parses CJS require', () =>
  Effect.gen(function* () {
    const source = "const { foo } = require('@myorg/utils')";
    const symbols = yield* parse('test.js', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('*');
    expect(symbols[0]?.source).toBe('@myorg/utils');
    expect(symbols[0]?.isNamespace).toBe(true);
    expect(symbols[0]?.isDynamic).toBe(false);
  }),
);

it.effect('parses dynamic import with string literal', () =>
  Effect.gen(function* () {
    const source = "const mod = await import('@myorg/utils')";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('*');
    expect(symbols[0]?.source).toBe('@myorg/utils');
    expect(symbols[0]?.isNamespace).toBe(false);
    expect(symbols[0]?.isDynamic).toBe(true);
  }),
);

it.effect('returns empty for dynamic import with variable', () =>
  Effect.gen(function* () {
    const source = 'const mod = await import(someVariable)';
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(0);
  }),
);

it.effect('parses type-only imports', () =>
  Effect.gen(function* () {
    const source = "import type { Foo } from '@myorg/types'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.name).toBe('Foo');
    expect(symbols[0]?.source).toBe('@myorg/types');
    expect(symbols[0]?.isNamespace).toBe(false);
    expect(symbols[0]?.isDynamic).toBe(false);
  }),
);

it.effect('returns empty for side-effect-only imports', () =>
  Effect.gen(function* () {
    const source = "import './side-effects'";
    const symbols = yield* parse('test.ts', source);
    expect(symbols).toHaveLength(0);
  }),
);

it.effect('returns ParseError for syntactically invalid source', () =>
  Effect.gen(function* () {
    const error = yield* parse('bad.ts', 'const = ;').pipe(Effect.flip);
    expect(error).toBeInstanceOf(ParseError);
    expect(error.filePath).toBe('bad.ts');
    expect(error.message).toBeTruthy();
  }),
);
