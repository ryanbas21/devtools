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
import { Console, Data, Effect, Layer } from 'effect';
import { WorkspaceDetector, WorkspaceDetectorLive } from './lib/workspace-detector.js';
import { FileScanner, FileScannerLive } from './lib/file-scanner.js';
import { ExportParser, ExportParserLive } from './lib/export-parser.js';
import { ImportParser, ImportParserLive } from './lib/import-parser.js';
import { ExportGraph, ExportGraphLive } from './lib/export-graph.js';
import { Reporter, ReporterLive } from './lib/reporter.js';
import type { ExportedSymbol, ImportedSymbol } from './lib/schemas.js';

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

// ─── Command ──────────────────────────────────────────────────────────────────

const command = Command.make(
  'dead-export-finder',
  { packages, ignore, verbose },
  ({ packages: packagesOpt, ignore: ignoreOpt, verbose }) =>
    Effect.gen(function* () {
      const startTime = Date.now();

      const detector = yield* WorkspaceDetector;
      const scanner = yield* FileScanner;
      const exportParser = yield* ExportParser;
      const importParser = yield* ImportParser;
      const graph = yield* ExportGraph;
      const reporter = yield* Reporter;
      const fs = yield* FileSystem.FileSystem;

      // 1. Detect workspace
      const cwd = process.cwd();
      const workspace = yield* detector.detect(cwd);

      if (verbose) {
        yield* Console.log(`Detected workspace type: ${workspace.type}`);
        yield* Console.log(`Found ${workspace.packages.length} packages`);
      }

      // 2. Determine target packages (for analysis) vs all packages (for imports)
      const packageFilter = packagesOpt._tag === 'Some' ? new Set(packagesOpt.value) : null;

      const targetPackages =
        packageFilter !== null
          ? workspace.packages.filter((p) => packageFilter.has(p.name))
          : workspace.packages;

      const allPackages = workspace.packages;

      const ignoreGlobs: readonly string[] = ignoreOpt._tag === 'Some' ? ignoreOpt.value : [];

      if (verbose && packageFilter !== null && targetPackages.length > 0) {
        yield* Console.log(`Scoping to packages: ${targetPackages.map((p) => p.name).join(', ')}`);
      }

      // 3. Scan ALL workspace packages for files
      const allExports = new Map<string, readonly ExportedSymbol[]>();
      const allImports = new Map<string, readonly ImportedSymbol[]>();
      const parseWarnings: string[] = [];

      for (const pkg of allPackages) {
        const files = yield* scanner.scan(pkg.root, ignoreGlobs).pipe(
          Effect.catchTag('GlobError', (e) =>
            Effect.gen(function* () {
              const msg = `failed to scan files in ${pkg.root}: ${String(e.cause)}`;
              parseWarnings.push(msg);
              if (verbose) {
                yield* Console.log(`Warning: ${msg}`);
              }
              return [] as readonly string[];
            }),
          ),
        );

        for (const filePath of files) {
          const sourceResult = yield* fs.readFileString(filePath, 'utf-8').pipe(Effect.either);

          if (sourceResult._tag === 'Left') {
            const msg = `could not read ${filePath}: ${String(sourceResult.left)}`;
            parseWarnings.push(msg);
            if (verbose) {
              yield* Console.log(`Warning: ${msg}`);
            }
            continue;
          }

          const source = sourceResult.right;

          // 4. Parse exports
          const exports = yield* exportParser.parse(filePath, source).pipe(
            Effect.catchTag('ParseError', (e) =>
              Effect.gen(function* () {
                const msg = `failed to parse exports in ${e.filePath}: ${e.message}`;
                parseWarnings.push(msg);
                if (verbose) {
                  yield* Console.log(`Warning: ${msg}`);
                }
                return [] as readonly ExportedSymbol[];
              }),
            ),
          );
          if (exports.length > 0) {
            allExports.set(filePath, exports);
          }

          // Parse imports
          const imports = yield* importParser.parse(filePath, source).pipe(
            Effect.catchTag('ParseError', (e) =>
              Effect.gen(function* () {
                const msg = `failed to parse imports in ${e.filePath}: ${e.message}`;
                parseWarnings.push(msg);
                if (verbose) {
                  yield* Console.log(`Warning: ${msg}`);
                }
                return [] as readonly ImportedSymbol[];
              }),
            ),
          );
          if (imports.length > 0) {
            allImports.set(filePath, imports);
          }
        }
      }

      if (verbose) {
        yield* Console.log(
          `Scanned ${allExports.size} files with exports, ${allImports.size} files with imports`,
        );
      }

      // 5. Analyze with ExportGraph (target packages for analysis, all imports)
      const result = yield* graph.analyze(targetPackages, allExports, allImports);

      // 6. Build package roots map for reporter
      const packageRoots = new Map<string, string>(allPackages.map((p) => [p.name, p.root]));

      // Format and print report
      const report = reporter.format(result, packageRoots);
      yield* Console.log(report);

      // 7. Surface warnings (always, not just verbose)
      const allWarnings = [...parseWarnings, ...result.warnings];
      if (allWarnings.length > 0 && !verbose) {
        yield* Console.log(
          `\nWarning: ${allWarnings.length} issue(s) during analysis — results may be incomplete. Run with --verbose for details.`,
        );
      }

      // 8. Verbose timing
      if (verbose) {
        const elapsed = Date.now() - startTime;
        yield* Console.log(`\nCompleted in ${elapsed}ms`);
      }

      // 9. Exit code 1 if dead exports found
      if (result.deadExports.length > 0) {
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
