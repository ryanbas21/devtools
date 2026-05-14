import { expect, layer } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { WorkspaceDetector, WorkspaceDetectorLive } from './workspace-detector.js';
import { FileScanner, FileScannerLive } from './file-scanner.js';
import { ExportParser, ExportParserLive } from './export-parser.js';
import { ImportParser, ImportParserLive } from './import-parser.js';
import { ExportGraph, ExportGraphLive } from './export-graph.js';
import { Reporter, ReporterLive } from './reporter.js';
import type { ExportedSymbol, ImportedSymbol } from './schemas.js';

// ─── Test layer ───────────────────────────────────────────────────────────────

// NodeContext.layer provides FileSystem + Path to both test bodies and service layers.
// The service layers are provided on each test effect via withServices().
const ServicesLayer = Layer.mergeAll(
  WorkspaceDetectorLive,
  FileScannerLive,
  ExportParserLive,
  ImportParserLive,
  ExportGraphLive,
  ReporterLive,
);

// ─── Integration test ─────────────────────────────────────────────────────────

layer(NodeContext.layer)('integration', (it) => {
  it.scoped(
    'end-to-end: flags internal as dead, keeps slugify and capitalize alive',
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        // ── Create synthetic monorepo in temp dir ──────────────────────────────

        const tmpDir = yield* fs.makeTempDirectoryScoped();

        // Root: pnpm-workspace.yaml
        yield* fs.writeFileString(
          path.join(tmpDir, 'pnpm-workspace.yaml'),
          'packages:\n  - "packages/*"\n',
        );

        // Package A: @test/utils
        const utilsDir = path.join(tmpDir, 'packages', 'utils');
        const utilsSrcDir = path.join(utilsDir, 'src');
        yield* fs.makeDirectory(utilsSrcDir, { recursive: true });

        yield* fs.writeFileString(
          path.join(utilsDir, 'package.json'),
          JSON.stringify({
            name: '@test/utils',
            exports: { '.': './src/index.ts' },
          }),
        );

        yield* fs.writeFileString(
          path.join(utilsSrcDir, 'index.ts'),
          "export { slugify, capitalize } from './string.js';\n",
        );

        yield* fs.writeFileString(
          path.join(utilsSrcDir, 'string.ts'),
          [
            "export function slugify(s: string): string { return s.toLowerCase().replace(/\\s+/g, '-'); }",
            'export function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }',
            'export function internal(s: string): string { return s.trim(); }',
          ].join('\n') + '\n',
        );

        // Package B: @test/app
        const appDir = path.join(tmpDir, 'packages', 'app');
        const appSrcDir = path.join(appDir, 'src');
        yield* fs.makeDirectory(appSrcDir, { recursive: true });

        yield* fs.writeFileString(
          path.join(appDir, 'package.json'),
          JSON.stringify({
            name: '@test/app',
            exports: { '.': './src/index.ts' },
          }),
        );

        yield* fs.writeFileString(
          path.join(appSrcDir, 'index.ts'),
          "import { slugify, capitalize } from '@test/utils';\nexport { slugify, capitalize };\n",
        );

        // ── Run the analysis pipeline ──────────────────────────────────────────

        const detector = yield* WorkspaceDetector;
        const scanner = yield* FileScanner;
        const exportParser = yield* ExportParser;
        const importParser = yield* ImportParser;
        const graph = yield* ExportGraph;
        const reporter = yield* Reporter;

        // Detect workspace
        const workspace = yield* detector.detect(tmpDir);

        // Scan and parse each package
        const allExports = new Map<string, readonly ExportedSymbol[]>();
        const allImports = new Map<string, readonly ImportedSymbol[]>();

        for (const pkg of workspace.packages) {
          const files = yield* scanner.scan(pkg.root, []);

          for (const filePath of files) {
            const source = yield* fs.readFileString(filePath, 'utf-8');

            const exports = yield* exportParser
              .parse(filePath, source)
              .pipe(Effect.catchTag('ParseError', () => Effect.succeed([])));

            const imports = yield* importParser
              .parse(filePath, source)
              .pipe(Effect.catchTag('ParseError', () => Effect.succeed([])));

            allExports.set(filePath, exports);
            allImports.set(filePath, imports);
          }
        }

        // Analyze
        const result = yield* graph.analyze(workspace.packages, allExports, allImports);

        // Build package roots map for reporter
        const packageRoots = new Map<string, string>(
          workspace.packages.map((pkg) => [pkg.name, pkg.root]),
        );

        // Format output
        const output = reporter.format(result, packageRoots);

        // ── Assertions ─────────────────────────────────────────────────────────

        const deadNames = result.deadExports.map((d) => d.symbol.name);

        // `internal` is exported from string.ts (non-entry-point) and nobody imports it
        expect(deadNames).toContain('internal');

        // `slugify` is re-exported from entry point index.ts — never flagged
        expect(deadNames).not.toContain('slugify');

        // `capitalize` is imported by @test/app — not dead
        expect(deadNames).not.toContain('capitalize');

        // Reporter output mentions the dead export
        expect(output).toContain('internal');
      }).pipe(Effect.provide(ServicesLayer)),
    { timeout: 30_000 },
  );

  it.scoped(
    'end-to-end: flags export in file not covered by barrel re-export',
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const tmpDir = yield* fs.makeTempDirectoryScoped();

        // Root: pnpm-workspace.yaml
        yield* fs.writeFileString(
          path.join(tmpDir, 'pnpm-workspace.yaml'),
          'packages:\n  - "packages/*"\n',
        );

        // Package: @test/types — barrel re-exports from schema.ts but NOT orphan.ts
        const typesDir = path.join(tmpDir, 'packages', 'types');
        const typesSrcDir = path.join(typesDir, 'src', 'lib');
        yield* fs.makeDirectory(typesSrcDir, { recursive: true });

        yield* fs.writeFileString(
          path.join(typesDir, 'package.json'),
          JSON.stringify({
            name: '@test/types',
            exports: { '.': './src/index.ts' },
          }),
        );

        yield* fs.writeFileString(
          path.join(typesDir, 'src', 'index.ts'),
          "export * from './lib/schema.js';\n",
        );

        yield* fs.writeFileString(
          path.join(typesSrcDir, 'schema.ts'),
          'export const MySchema = {};\nexport type MyType = string;\n',
        );

        // orphan.ts exports something but is never imported or re-exported
        yield* fs.writeFileString(
          path.join(typesSrcDir, 'orphan.ts'),
          'export const DeadExport = {};\n',
        );

        // Package: @test/app — consumes @test/types
        const appDir = path.join(tmpDir, 'packages', 'app');
        const appSrcDir = path.join(appDir, 'src');
        yield* fs.makeDirectory(appSrcDir, { recursive: true });

        yield* fs.writeFileString(
          path.join(appDir, 'package.json'),
          JSON.stringify({
            name: '@test/app',
            exports: { '.': './src/index.ts' },
          }),
        );

        yield* fs.writeFileString(
          path.join(appSrcDir, 'index.ts'),
          "import { MySchema } from '@test/types';\nexport const app = MySchema;\n",
        );

        // ── Run analysis ──────────────────────────────────────────────────────

        const detector = yield* WorkspaceDetector;
        const scanner = yield* FileScanner;
        const exportParser = yield* ExportParser;
        const importParser = yield* ImportParser;
        const graph = yield* ExportGraph;

        const workspace = yield* detector.detect(tmpDir);

        const allExports = new Map<string, readonly ExportedSymbol[]>();
        const allImports = new Map<string, readonly ImportedSymbol[]>();

        for (const pkg of workspace.packages) {
          const files = yield* scanner.scan(pkg.root, []);
          for (const filePath of files) {
            const source = yield* fs.readFileString(filePath, 'utf-8');
            const exports = yield* exportParser
              .parse(filePath, source)
              .pipe(Effect.catchTag('ParseError', () => Effect.succeed([])));
            const imports = yield* importParser
              .parse(filePath, source)
              .pipe(Effect.catchTag('ParseError', () => Effect.succeed([])));
            allExports.set(filePath, exports);
            allImports.set(filePath, imports);
          }
        }

        // Analyze with ALL packages (the full-workspace scenario)
        const result = yield* graph.analyze(workspace.packages, allExports, allImports);

        // ── Assertions ────────────────────────────────────────────────────────

        const deadNames = result.deadExports.map((d) => d.symbol.name);

        // DeadExport is in orphan.ts which nobody imports or re-exports
        expect(deadNames).toContain('DeadExport');

        // MySchema is consumed by @test/app via package specifier
        expect(deadNames).not.toContain('MySchema');

        // MyType is protected by the star re-export from index.ts
        expect(deadNames).not.toContain('MyType');
      }).pipe(Effect.provide(ServicesLayer)),
    { timeout: 30_000 },
  );
});
