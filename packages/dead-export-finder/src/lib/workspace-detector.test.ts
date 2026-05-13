import { expect, layer } from '@effect/vitest';
import { Effect } from 'effect';
import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { WorkspaceDetector, WorkspaceDetectorLive } from './workspace-detector.js';
import { WorkspaceNotFoundError } from './errors.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const writeJson = (filePath: string, data: unknown) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(filePath, JSON.stringify(data));
  });

// ─── tests ────────────────────────────────────────────────────────────────────
// Use NodeContext.layer as the outer layer (provides FileSystem + Path to test body).
// WorkspaceDetectorLive is provided per-test via Effect.provide so it can also
// access FileSystem from NodeContext.

layer(NodeContext.layer)('WorkspaceDetector', (it) => {
  // Helper: run a program that needs WorkspaceDetector, with WorkspaceDetectorLive
  // provided on top of the already-running NodeContext.
  const withDetector = <A>(
    program: Effect.Effect<A, unknown, WorkspaceDetector | FileSystem.FileSystem | Path.Path>,
  ) => program.pipe(Effect.provide(WorkspaceDetectorLive));

  it.scoped('detects pnpm workspace from pnpm-workspace.yaml', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(
          path.join(tmpDir, 'pnpm-workspace.yaml'),
          'packages:\n  - "packages/*"\n',
        );

        const pkgDir = path.join(tmpDir, 'packages', 'my-pkg');
        yield* fs.makeDirectory(pkgDir, { recursive: true });
        yield* writeJson(path.join(pkgDir, 'package.json'), {
          name: 'my-pkg',
          main: './dist/index.js',
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('pnpm');
        expect(result.root).toBe(tmpDir);
        expect(result.packages.length).toBeGreaterThan(0);
        expect(result.packages[0].name).toBe('my-pkg');
      }),
    ),
  );

  it.scoped('reads main/module/types fields as fallback entry points', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* writeJson(path.join(tmpDir, 'package.json'), {
          name: 'my-lib',
          main: './dist/index.cjs',
          module: './dist/index.js',
          types: './dist/index.d.ts',
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('single');
        expect(result.packages).toHaveLength(1);
        const { entryPoints } = result.packages[0];
        expect(entryPoints).toContain('./dist/index.cjs');
        expect(entryPoints).toContain('./dist/index.js');
        expect(entryPoints).toContain('./dist/index.d.ts');
      }),
    ),
  );

  it.scoped('reads subpath exports as entry points', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* writeJson(path.join(tmpDir, 'package.json'), {
          name: 'exports-pkg',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
            },
            './utils': {
              types: './dist/utils.d.ts',
              import: './dist/utils.js',
            },
          },
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('single');
        expect(result.packages).toHaveLength(1);
        const { entryPoints } = result.packages[0];
        expect(entryPoints).toContain('./dist/index.d.ts');
        expect(entryPoints).toContain('./dist/index.js');
        expect(entryPoints).toContain('./dist/utils.d.ts');
        expect(entryPoints).toContain('./dist/utils.js');
      }),
    ),
  );

  it.scoped('detects npm workspace from package.json workspaces field', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* writeJson(path.join(tmpDir, 'package.json'), {
          name: 'my-monorepo',
          workspaces: ['packages/*'],
        });

        const pkgDir = path.join(tmpDir, 'packages', 'alpha');
        yield* fs.makeDirectory(pkgDir, { recursive: true });
        yield* writeJson(path.join(pkgDir, 'package.json'), {
          name: 'alpha',
          main: './dist/index.js',
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('npm');
        expect(result.root).toBe(tmpDir);
        expect(result.packages.length).toBeGreaterThan(0);
        expect(result.packages[0].name).toBe('alpha');
      }),
    ),
  );

  it.scoped('detects nx workspace from nx.json', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'nx.json'), '{}');
        yield* writeJson(path.join(tmpDir, 'package.json'), { name: 'nx-root' });

        const pkgDir = path.join(tmpDir, 'packages', 'foo');
        yield* fs.makeDirectory(pkgDir, { recursive: true });
        yield* writeJson(path.join(pkgDir, 'package.json'), {
          name: 'foo',
          main: './dist/index.js',
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('nx');
        expect(result.root).toBe(tmpDir);
        expect(result.packages.length).toBeGreaterThan(0);
      }),
    ),
  );

  it.scoped('detects turborepo workspace from turbo.json', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'turbo.json'), '{}');
        yield* writeJson(path.join(tmpDir, 'package.json'), { name: 'turbo-root' });

        const pkgDir = path.join(tmpDir, 'packages', 'foo');
        yield* fs.makeDirectory(pkgDir, { recursive: true });
        yield* writeJson(path.join(pkgDir, 'package.json'), {
          name: 'foo',
          main: './dist/index.js',
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('turborepo');
        expect(result.root).toBe(tmpDir);
        expect(result.packages.length).toBeGreaterThan(0);
      }),
    ),
  );

  it.scoped('yields WorkspaceNotFoundError when no package.json exists at cwd', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        // tmpDir is empty — no package.json, no workspace config
        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir).pipe(Effect.flip);

        expect(result).toBeInstanceOf(WorkspaceNotFoundError);
        expect((result as WorkspaceNotFoundError).cwd).toBe(tmpDir);
      }),
    ),
  );

  it.scoped('falls back to single package when no workspace detected', () =>
    withDetector(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* writeJson(path.join(tmpDir, 'package.json'), {
          name: 'standalone',
          main: './index.js',
        });

        const detector = yield* WorkspaceDetector;
        const result = yield* detector.detect(tmpDir);

        expect(result.type).toBe('single');
        expect(result.root).toBe(tmpDir);
        expect(result.packages).toHaveLength(1);
        expect(result.packages[0].name).toBe('standalone');
      }),
    ),
  );
});
