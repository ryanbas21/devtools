import { expect, layer } from '@effect/vitest';
import { Effect } from 'effect';
import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { FileScanner, FileScannerLive } from './file-scanner.js';

// ─── tests ────────────────────────────────────────────────────────────────────

layer(NodeContext.layer)('FileScanner', (it) => {
  const withScanner = <A>(
    program: Effect.Effect<A, unknown, FileScanner | FileSystem.FileSystem | Path.Path>,
  ) => program.pipe(Effect.provide(FileScannerLive));

  it.scoped('finds .ts and .tsx files, excludes other extensions', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'index.ts'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'App.tsx'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'styles.css'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'README.md'), '');

        const scanner = yield* FileScanner;
        const files = yield* scanner.scan(tmpDir, []);

        const names = files.map((f) => path.basename(f));
        expect(names).toContain('index.ts');
        expect(names).toContain('App.tsx');
        expect(names).not.toContain('styles.css');
        expect(names).not.toContain('README.md');
      }),
    ),
  );

  it.scoped('excludes node_modules', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'index.ts'), '');

        const nmDir = path.join(tmpDir, 'node_modules', 'some-pkg');
        yield* fs.makeDirectory(nmDir, { recursive: true });
        yield* fs.writeFileString(path.join(nmDir, 'index.ts'), '');

        const scanner = yield* FileScanner;
        const files = yield* scanner.scan(tmpDir, []);

        // All returned paths should not be inside node_modules
        const hasNodeModules = files.some((f) => f.includes('node_modules'));
        expect(hasNodeModules).toBe(false);
        expect(files.length).toBe(1);
      }),
    ),
  );

  it.scoped('respects .gitignore patterns', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, '.gitignore'), 'dist/\n');
        yield* fs.writeFileString(path.join(tmpDir, 'index.ts'), '');

        const distDir = path.join(tmpDir, 'dist');
        yield* fs.makeDirectory(distDir, { recursive: true });
        yield* fs.writeFileString(path.join(distDir, 'index.js'), '');
        yield* fs.writeFileString(path.join(distDir, 'index.d.ts'), '');

        const scanner = yield* FileScanner;
        const files = yield* scanner.scan(tmpDir, []);

        const hasDistFiles = files.some((f) => f.includes('/dist/'));
        expect(hasDistFiles).toBe(false);
        expect(files.some((f) => f.endsWith('index.ts'))).toBe(true);
      }),
    ),
  );

  it.scoped('finds all JS/TS extensions (.js, .jsx, .mjs, .cjs)', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'index.js'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'component.jsx'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'esm.mjs'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'cjs.cjs'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'styles.css'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'data.json'), '');

        const scanner = yield* FileScanner;
        const files = yield* scanner.scan(tmpDir, []);

        const names = files.map((f) => path.basename(f));
        expect(names).toContain('index.js');
        expect(names).toContain('component.jsx');
        expect(names).toContain('esm.mjs');
        expect(names).toContain('cjs.cjs');
        expect(names).not.toContain('styles.css');
        expect(names).not.toContain('data.json');
      }),
    ),
  );

  it.scoped('inherits .gitignore from workspace root', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        // Workspace root has .gitignore excluding dist/
        yield* fs.writeFileString(path.join(tmpDir, '.gitignore'), 'dist/\n');

        // Package is nested under packages/my-lib
        const pkgDir = path.join(tmpDir, 'packages', 'my-lib');
        const srcDir = path.join(pkgDir, 'src');
        const distDir = path.join(pkgDir, 'dist');
        yield* fs.makeDirectory(srcDir, { recursive: true });
        yield* fs.makeDirectory(distDir, { recursive: true });

        yield* fs.writeFileString(path.join(srcDir, 'index.ts'), '');
        yield* fs.writeFileString(path.join(distDir, 'index.js'), '');
        yield* fs.writeFileString(path.join(distDir, 'index.d.ts'), '');

        const scanner = yield* FileScanner;
        // Pass workspaceRoot so parent .gitignore is found
        const files = yield* scanner.scan(pkgDir, [], tmpDir);

        const names = files.map((f) => path.basename(f));
        expect(names).toContain('index.ts');
        expect(names).not.toContain('index.js');
        expect(names).not.toContain('index.d.ts');
      }),
    ),
  );

  it.scoped('excludes config files by default', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'index.ts'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'vite.config.ts'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'eslint.config.mjs'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'vitest.config.ts'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'tsconfig.json'), '');

        const scanner = yield* FileScanner;
        const files = yield* scanner.scan(tmpDir, []);

        const names = files.map((f) => path.basename(f));
        expect(names).toContain('index.ts');
        expect(names).not.toContain('vite.config.ts');
        expect(names).not.toContain('eslint.config.mjs');
        expect(names).not.toContain('vitest.config.ts');
      }),
    ),
  );

  it.scoped('respects custom ignore globs', () =>
    withScanner(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, 'index.ts'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'index.test.ts'), '');
        yield* fs.writeFileString(path.join(tmpDir, 'util.spec.ts'), '');

        const scanner = yield* FileScanner;
        const files = yield* scanner.scan(tmpDir, ['**/*.test.ts', '**/*.spec.ts']);

        const names = files.map((f) => path.basename(f));
        expect(names).toContain('index.ts');
        expect(names).not.toContain('index.test.ts');
        expect(names).not.toContain('util.spec.ts');
      }),
    ),
  );
});
