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
  ({ name, root, entryPoints }) as PackageInfo;

const makeExport = (
  name: string,
  filePath: string,
  line = 1,
  isDefault = false,
  isReExport = false,
  reExportSource?: string,
): ExportedSymbol =>
  ({ name, filePath, line, isDefault, isReExport, reExportSource }) as ExportedSymbol;

const makeImport = (
  name: string,
  filePath: string,
  source: string,
  isNamespace = false,
  isDynamic = false,
): ImportedSymbol => ({ name, filePath, source, isNamespace, isDynamic }) as ImportedSymbol;

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

it.effect('empty packages array produces zero dead exports', () =>
  Effect.gen(function* () {
    // When no packages are provided (the bug that occurred when Options.repeated
    // returned Some([]) instead of None), every file is unmappable and silently
    // skipped, producing zero dead exports even though dead code exists.
    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', [makeExport('publicFn', '/test/utils/src/index.ts')]],
      ['/test/utils/src/internal.ts', [makeExport('helperFn', '/test/utils/src/internal.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([], allExports, allImports);

    // With no packages, nothing can be attributed → nothing flagged
    expect(result.deadExports).toHaveLength(0);
    // But exports are still counted
    expect(result.totalExports).toBe(2);
  }),
);

it.effect('file not covered by star re-export is flagged as dead', () =>
  Effect.gen(function* () {
    // index.ts re-exports everything from ./lib/used via export *, but
    // ./lib/orphan.ts is never re-exported or imported by anyone.
    const pkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      [
        '/test/utils/src/index.ts',
        [makeExport('*', '/test/utils/src/index.ts', 1, false, true, './lib/used')],
      ],
      [
        '/test/utils/src/lib/used.ts',
        [
          makeExport('a', '/test/utils/src/lib/used.ts'),
          makeExport('b', '/test/utils/src/lib/used.ts'),
        ],
      ],
      ['/test/utils/src/lib/orphan.ts', [makeExport('dead', '/test/utils/src/lib/orphan.ts')]],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>();

    const result = yield* analyze([pkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    // a and b are protected by the star re-export
    expect(deadNames).not.toContain('a');
    expect(deadNames).not.toContain('b');
    // dead is in a file nobody re-exports or imports
    expect(deadNames).toContain('dead');
    expect(result.deadExports).toHaveLength(1);
  }),
);

it.effect('cross-package named import marks export as consumed', () =>
  Effect.gen(function* () {
    // @test/app imports { helperFn } from '@test/utils' by package name.
    // helperFn lives in a non-entry-point file, but the package-specifier
    // import should mark it as consumed.
    const utilsPkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);
    const appPkg = makePackage('@test/app', '/test/app', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', []],
      ['/test/utils/src/internal.ts', [makeExport('helperFn', '/test/utils/src/internal.ts')]],
      ['/test/app/src/index.ts', []],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>([
      ['/test/app/src/index.ts', [makeImport('helperFn', '/test/app/src/index.ts', '@test/utils')]],
    ]);

    const result = yield* analyze([utilsPkg, appPkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('helperFn');
  }),
);

it.effect('cross-package named import does not protect unrelated exports', () =>
  Effect.gen(function* () {
    // @test/app imports { used } from '@test/utils', but @test/utils also
    // exports { unused } from a different file. Only unused should be dead.
    const utilsPkg = makePackage('@test/utils', '/test/utils', ['./src/index.ts']);
    const appPkg = makePackage('@test/app', '/test/app', ['./src/index.ts']);

    const allExports = new Map<string, readonly ExportedSymbol[]>([
      ['/test/utils/src/index.ts', []],
      ['/test/utils/src/used.ts', [makeExport('used', '/test/utils/src/used.ts')]],
      ['/test/utils/src/unused.ts', [makeExport('unused', '/test/utils/src/unused.ts')]],
      ['/test/app/src/index.ts', []],
    ]);

    const allImports = new Map<string, readonly ImportedSymbol[]>([
      ['/test/app/src/index.ts', [makeImport('used', '/test/app/src/index.ts', '@test/utils')]],
    ]);

    const result = yield* analyze([utilsPkg, appPkg], allExports, allImports);

    const deadNames = result.deadExports.map((d) => d.symbol.name);
    expect(deadNames).not.toContain('used');
    expect(deadNames).toContain('unused');
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
