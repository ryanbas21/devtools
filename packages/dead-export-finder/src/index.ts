#!/usr/bin/env node

// Public API
export { WorkspaceDetector, WorkspaceDetectorLive } from './lib/workspace-detector.js';
export type { WorkspaceResult } from './lib/workspace-detector.js';
export { FileScanner, FileScannerLive } from './lib/file-scanner.js';
export { ExportParser, ExportParserLive } from './lib/export-parser.js';
export { ImportParser, ImportParserLive } from './lib/import-parser.js';
export { ExportGraph, ExportGraphLive } from './lib/export-graph.js';
export { Reporter, ReporterLive } from './lib/reporter.js';
export { WorkspaceNotFoundError, ParseError, EntryPointResolutionError } from './lib/errors.js';
export type {
  PackageInfo,
  ExportedSymbol,
  ImportedSymbol,
  DeadExport,
  AnalysisResult,
} from './lib/schemas.js';

import { Command, Options } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { FileSystem } from '@effect/platform';
import { Console, Data, Effect, Layer, Array as Arr, Option, pipe } from 'effect';
import { WorkspaceDetector, WorkspaceDetectorLive } from './lib/workspace-detector.js';
import type { WorkspaceResult } from './lib/workspace-detector.js';
import { FileScanner, FileScannerLive } from './lib/file-scanner.js';
import { ExportParser, ExportParserLive } from './lib/export-parser.js';
import { ImportParser, ImportParserLive } from './lib/import-parser.js';
import { ExportGraph, ExportGraphLive } from './lib/export-graph.js';
import { Reporter, ReporterLive } from './lib/reporter.js';
import type { PackageInfo, ExportedSymbol, ImportedSymbol } from './lib/schemas.js';

// ─── Exit code error ──────────────────────────────────────────────────────────

class ExitWithCode extends Data.TaggedError('ExitWithCode')<{
  readonly code: number;
}> {}

// ─── Options ──────────────────────────────────────────────────────────────────

const packages = Options.text('packages').pipe(
  Options.withAlias('p'),
  Options.withDescription('Scope analysis to specific package names (repeat for multiple).'),
  Options.repeated,
  Options.optional,
);

const ignore = Options.text('ignore').pipe(
  Options.withAlias('i'),
  Options.withDescription('Glob patterns to exclude from scanning (repeat for multiple).'),
  Options.repeated,
  Options.optional,
);

const verbose = Options.boolean('verbose').pipe(
  Options.withAlias('v'),
  Options.withDescription('Print verbose output including timing and parse warnings.'),
  Options.withDefault(false),
);

// ─── Layer ────────────────────────────────────────────────────────────────────

const AppLayer = Layer.mergeAll(
  ExportParserLive,
  ImportParserLive,
  ExportGraphLive,
  ReporterLive,
  WorkspaceDetectorLive,
  FileScannerLive,
).pipe(Layer.provideMerge(NodeContext.layer));

// ─── Pipeline stages ────────────────────────────────────────────────────────

interface ScanResult {
  readonly filesByPackage: ReadonlyArray<readonly [PackageInfo, ReadonlyArray<string>]>;
  readonly warnings: ReadonlyArray<string>;
}

const scanWorkspace = (
  workspace: WorkspaceResult,
  ignoreGlobs: readonly string[],
  isVerbose: boolean,
): Effect.Effect<ScanResult, never, FileScanner> =>
  Effect.gen(function* () {
    const scanner = yield* FileScanner;

    const results = yield* Effect.all(
      pipe(
        workspace.packages,
        Arr.map((pkg) =>
          pipe(
            scanner.scan(pkg.root, ignoreGlobs),
            Effect.catchTag('GlobError', (e) =>
              Effect.gen(function* () {
                const msg = `failed to scan files in ${pkg.root}: ${String(e.cause)}`;
                if (isVerbose) yield* Console.log(`Warning: ${msg}`);
                return { files: [] as readonly string[], warning: msg };
              }),
            ),
            Effect.map((result) =>
              'warning' in (result as object)
                ? (result as { files: readonly string[]; warning: string })
                : { files: result as readonly string[], warning: null as string | null },
            ),
            Effect.map((r) => ({ pkg, files: r.files, warning: r.warning })),
          ),
        ),
      ),
    );

    return {
      filesByPackage: pipe(
        results,
        Arr.map((r) => [r.pkg, r.files] as const),
      ),
      warnings: pipe(
        results,
        Arr.filterMap((r) => (r.warning !== null ? Option.some(r.warning) : Option.none())),
      ),
    };
  });

interface ParseResult {
  readonly allExports: ReadonlyMap<string, readonly ExportedSymbol[]>;
  readonly allImports: ReadonlyMap<string, readonly ImportedSymbol[]>;
  readonly warnings: ReadonlyArray<string>;
}

const parseAllFiles = (
  filesByPackage: ReadonlyArray<readonly [PackageInfo, ReadonlyArray<string>]>,
  isVerbose: boolean,
): Effect.Effect<ParseResult, never, ExportParser | ImportParser | FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exportParser = yield* ExportParser;
    const importParser = yield* ImportParser;

    const allFiles = pipe(
      filesByPackage,
      Arr.flatMap(([, files]) => files),
    );

    const fileResults = yield* Effect.all(
      pipe(
        allFiles,
        Arr.map((filePath) =>
          pipe(
            fs.readFileString(filePath, 'utf-8'),
            Effect.either,
            Effect.flatMap((sourceResult) => {
              if (sourceResult._tag === 'Left') {
                const msg = `could not read ${filePath}: ${String(sourceResult.left)}`;
                return isVerbose
                  ? pipe(
                      Console.log(`Warning: ${msg}`),
                      Effect.map(() => ({
                        filePath,
                        exports: [] as readonly ExportedSymbol[],
                        imports: [] as readonly ImportedSymbol[],
                        warning: msg as string | null,
                      })),
                    )
                  : Effect.succeed({
                      filePath,
                      exports: [] as readonly ExportedSymbol[],
                      imports: [] as readonly ImportedSymbol[],
                      warning: msg as string | null,
                    });
              }

              const source = sourceResult.right;

              const parseExports = pipe(
                exportParser.parse(filePath, source),
                Effect.map(
                  (symbols): { symbols: readonly ExportedSymbol[]; warning: string | null } => ({
                    symbols,
                    warning: null,
                  }),
                ),
                Effect.catchTag('ParseError', (e) => {
                  const msg = `failed to parse exports in ${e.filePath}: ${e.message}`;
                  const result = { symbols: [] as readonly ExportedSymbol[], warning: msg };
                  return isVerbose
                    ? pipe(
                        Console.log(`Warning: ${msg}`),
                        Effect.map(() => result),
                      )
                    : Effect.succeed(result);
                }),
              );

              const parseImports = pipe(
                importParser.parse(filePath, source),
                Effect.map(
                  (symbols): { symbols: readonly ImportedSymbol[]; warning: string | null } => ({
                    symbols,
                    warning: null,
                  }),
                ),
                Effect.catchTag('ParseError', (e) => {
                  const msg = `failed to parse imports in ${e.filePath}: ${e.message}`;
                  const result = { symbols: [] as readonly ImportedSymbol[], warning: msg };
                  return isVerbose
                    ? pipe(
                        Console.log(`Warning: ${msg}`),
                        Effect.map(() => result),
                      )
                    : Effect.succeed(result);
                }),
              );

              return pipe(
                Effect.all({ exports: parseExports, imports: parseImports }),
                Effect.map(({ exports: exp, imports: imp }) => ({
                  filePath,
                  exports: exp.symbols,
                  imports: imp.symbols,
                  warning: exp.warning ?? imp.warning,
                })),
              );
            }),
          ),
        ),
      ),
    );

    const exportEntries = pipe(
      fileResults,
      Arr.filter((r) => r.exports.length > 0),
      Arr.map((r) => [r.filePath, r.exports] as const),
    );

    const importEntries = pipe(
      fileResults,
      Arr.filter((r) => r.imports.length > 0),
      Arr.map((r) => [r.filePath, r.imports] as const),
    );

    const warnings = pipe(
      fileResults,
      Arr.filterMap((r) => (r.warning !== null ? Option.some(r.warning) : Option.none())),
    );

    return {
      allExports: new Map(exportEntries) as ReadonlyMap<string, readonly ExportedSymbol[]>,
      allImports: new Map(importEntries) as ReadonlyMap<string, readonly ImportedSymbol[]>,
      warnings,
    };
  });

const analyzeAndReport = (
  targetPackages: ReadonlyArray<PackageInfo>,
  allPackages: ReadonlyArray<PackageInfo>,
  allExports: ReadonlyMap<string, readonly ExportedSymbol[]>,
  allImports: ReadonlyMap<string, readonly ImportedSymbol[]>,
): Effect.Effect<
  { readonly deadCount: number; readonly warnings: ReadonlyArray<string> },
  never,
  ExportGraph | Reporter
> =>
  Effect.gen(function* () {
    const graph = yield* ExportGraph;
    const reporter = yield* Reporter;

    const result = yield* graph.analyze(targetPackages, allExports, allImports);

    const packageRoots: ReadonlyMap<string, string> = new Map(
      pipe(
        allPackages,
        Arr.map((p) => [p.name, p.root] as const),
      ),
    );

    const report = reporter.format(result, packageRoots);
    yield* Console.log(report);

    return { deadCount: result.deadExports.length, warnings: result.warnings };
  });

// ─── Command ──────────────────────────────────────────────────────────────────

const command = Command.make(
  'dead-export-finder',
  { packages, ignore, verbose },
  ({ packages: packagesOpt, ignore: ignoreOpt, verbose: isVerbose }) =>
    Effect.gen(function* () {
      const startTime = Date.now();

      const detector = yield* WorkspaceDetector;
      const cwd = process.cwd();
      const workspace = yield* detector.detect(cwd);

      if (isVerbose) {
        yield* Console.log(`Detected workspace type: ${workspace.type}`);
        yield* Console.log(`Found ${workspace.packages.length} packages`);
      }

      const packageFilter = packagesOpt._tag === 'Some' ? new Set(packagesOpt.value) : null;

      const targetPackages =
        packageFilter !== null
          ? pipe(
              workspace.packages,
              Arr.filter((p) => packageFilter.has(p.name)),
            )
          : [...workspace.packages];

      const ignoreGlobs: readonly string[] = ignoreOpt._tag === 'Some' ? ignoreOpt.value : [];

      if (isVerbose && packageFilter !== null && targetPackages.length > 0) {
        yield* Console.log(
          `Scoping to packages: ${pipe(
            targetPackages,
            Arr.map((p) => p.name),
            Arr.join(', '),
          )}`,
        );
      }

      const scanResult = yield* scanWorkspace(workspace, ignoreGlobs, isVerbose);

      const parseResult = yield* parseAllFiles(scanResult.filesByPackage, isVerbose);

      if (isVerbose) {
        yield* Console.log(
          `Scanned ${parseResult.allExports.size} files with exports, ${parseResult.allImports.size} files with imports`,
        );
      }

      const { deadCount, warnings: analysisWarnings } = yield* analyzeAndReport(
        targetPackages,
        [...workspace.packages],
        parseResult.allExports,
        parseResult.allImports,
      );

      const allWarnings = pipe(
        scanResult.warnings,
        Arr.appendAll(parseResult.warnings),
        Arr.appendAll(analysisWarnings),
      );

      if (allWarnings.length > 0 && !isVerbose) {
        yield* Console.log(
          `\nWarning: ${allWarnings.length} issue(s) during analysis — results may be incomplete. Run with --verbose for details.`,
        );
      }

      if (isVerbose) {
        const elapsed = Date.now() - startTime;
        yield* Console.log(`\nCompleted in ${elapsed}ms`);
      }

      if (deadCount > 0) {
        return yield* new ExitWithCode({ code: 1 });
      }
    }),
).pipe(Command.withDescription('Find dead exports across monorepo package boundaries.'));

// ─── Runner ───────────────────────────────────────────────────────────────────

const cli = Command.run(command, {
  name: 'Dead Export Finder',
  version: '0.0.0',
});

cli(process.argv).pipe(
  Effect.catchTags({
    ExitWithCode: (e) => Effect.sync(() => (process.exitCode = e.code)),
    WorkspaceNotFoundError: (e) =>
      Console.error(`error: workspace not found at ${e.cwd}`).pipe(
        Effect.zipRight(
          Effect.sync(() => {
            process.exitCode = 1;
          }),
        ),
      ),
  }),
  Effect.provide(AppLayer),
  NodeRuntime.runMain,
);
