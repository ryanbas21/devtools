import { it } from '@effect/vitest';
import { expect } from 'vitest';
import { Effect } from 'effect';
import { ExportGraph, ExportGraphLive } from './export-graph.js';
import type { PackageInfo, ExportedSymbol, ImportedSymbol } from './schemas.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const analyze = (
  packages: readonly PackageInfo[],
  allExports: Map<string, readonly ExportedSymbol[]>,
  allImports: Map<string, readonly ImportedSymbol[]>,
) =>
  Effect.gen(function* () {
    const graph = yield* ExportGraph;
    return yield* graph.analyze(packages, allExports, allImports);
  }).pipe(Effect.provide(ExportGraphLive));

// ─── test data factories ───────────────────────────────────────────────────────

const makePackage = (name: string, root: string, entryPoints: string[]): PackageInfo =>
  ({ name, root, entryPoints }) as unknown as PackageInfo;

const makeExport = (
  name: string,
  filePath: string,
  line = 1,
  isDefault = false,
  isReExport = false,
  reExportSource?: string,
): ExportedSymbol =>
  ({ name, filePath, line, isDefault, isReExport, reExportSource }) as unknown as ExportedSymbol;

const makeImport = (
  name: string,
  filePath: string,
  source: string,
  isNamespace = false,
  isDynamic = false,
): ImportedSymbol =>
  ({ name, filePath, source, isNamespace, isDynamic }) as unknown as ImportedSymbol;

// ─── tests ────────────────────────────────────────────────────────────────────

it.effect('entry point exports are never flagged', () =>
  Effect.gen(function* () {
    // Package has two files: index (entry point) and internal.
    // Index exports `publicFn` but nobody imports it externally.
    // Internal exports `helperFn` and nobody imports it.
    // Only `helperFn` should be flagged; `publicFn` is sacred.
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', [makeExport('publicFn', '/test/utils/src/index.ts')]],
      ['/test/utils/src/internal.ts', [makeExport('helperFn', '/test/utils/src/internal.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('publicFn');
    expect(deadNames).toContain('helperFn');
  }),
);

it.effect('flags non-entry-point exports with no consumers', () =>
  Effect.gen(function* () {
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', []],
      ['/test/utils/src/internal.ts', [makeExport('helperFn', '/test/utils/src/internal.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    expect(result.deadExports).toHaveLength(1);
    expect(result.deadExports[0]?.symbol.name).toBe('helperFn');
    expect(result.deadExports[0]?.packageName).toBe('@test/utils');
  }),
);

it.effect('does not flag exports consumed by other files via relative import', () =>
  Effect.gen(function* () {
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', []],
      ['/test/utils/src/internal.ts', [makeExport('helperFn', '/test/utils/src/internal.ts')]],
    ]);

    // Index file imports helperFn from './internal' (relative, no extension)
    const allImports = new Map<string, readonly ImportedSymbol[]>([
      [
        '/test/utils/src/index.ts',
        [makeImport('helperFn', '/test/utils/src/index.ts', './internal')],
      ],
    ]);

    const result = yield* analyze([pkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('helperFn');
  }),
);

it.effect('treats namespace imports as consuming all exports from the source', () =>
  Effect.gen(function* () {
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', []],
      [
        '/test/utils/src/internal.ts',
        [
          makeExport('a', '/test/utils/src/internal.ts'),
          makeExport('b', '/test/utils/src/internal.ts'),
        ],
      ],
    ]);

    // Consumer does: import * as utils from './internal'
    const allImports = new Map<string, readonly ImportedSymbol[]>([
      [
        '/test/utils/src/consumer.ts',
        [makeImport('*', '/test/utils/src/consumer.ts', './internal', true)],
      ],
    ]);

    const result = yield* analyze([pkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('a');
    expect(deadNames).not.toContain('b');
  }),
);

it.effect('multi-hop re-export chain protects source exports', () =>
  Effect.gen(function* () {
    // entry -> barrel -> impl
    // Entry re-exports from barrel, barrel re-exports from impl.
    // impl's exports should NOT be flagged.
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      [
        '/test/utils/src/index.ts',
        [makeExport('foo', '/test/utils/src/index.ts', 1, false, true, './barrel')],
      ],
      [
        '/test/utils/src/barrel.ts',
        [makeExport('foo', '/test/utils/src/barrel.ts', 1, false, true, './impl')],
      ],
      ['/test/utils/src/impl.ts', [makeExport('foo', '/test/utils/src/impl.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('foo');
    expect(result.deadExports).toHaveLength(0);
  }),
);

it.effect('star re-export from entry point protects all source exports', () =>
  Effect.gen(function* () {
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      [
        '/test/utils/src/index.ts',
        [makeExport('*', '/test/utils/src/index.ts', 1, false, true, './internal')],
      ],
      [
        '/test/utils/src/internal.ts',
        [
          makeExport('a', '/test/utils/src/internal.ts'),
          makeExport('b', '/test/utils/src/internal.ts'),
        ],
      ],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('a');
    expect(deadNames).not.toContain('b');
    expect(result.deadExports).toHaveLength(0);
  }),
);

it.effect('package specifier re-export does not crash or create incorrect edges', () =>
  Effect.gen(function* () {
    // Entry point re-exports from a package specifier like 'effect'.
    // This should not crash and should not create any consumption edges.
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      [
        '/test/utils/src/index.ts',
        [makeExport('Effect', '/test/utils/src/index.ts', 1, false, true, 'effect')],
      ],
      ['/test/utils/src/internal.ts', [makeExport('helperFn', '/test/utils/src/internal.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    // helperFn is not consumed by anything — should be flagged
    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).toContain('helperFn');
    // No crash occurred
    expect(result.totalFiles).toBe(2);
  }),
);

it.effect('silently skips files that cannot be attributed to any package', () =>
  Effect.gen(function* () {
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', [makeExport('publicFn', '/test/utils/src/index.ts')]],
      // This file is outside any known package root
      ['/other/unknown/file.ts', [makeExport('orphan', '/other/unknown/file.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    // orphan is not flagged as dead (it's outside any known package)
    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('orphan');
    // publicFn is in entry point — safe
    expect(deadNames).not.toContain('publicFn');
  }),
);
