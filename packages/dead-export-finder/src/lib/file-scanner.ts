import { Context, Data, Effect, Layer } from 'effect';
import { FileSystem, Path } from '@effect/platform';
import fg from 'fast-glob';
import ignore from 'ignore';

// ─── Internal errors ──────────────────────────────────────────────────────────

class GlobError extends Data.TaggedError('GlobError')<{
  readonly cause: unknown;
}> {}

// ─── Service interface ────────────────────────────────────────────────────────

export interface FileScannerShape {
  readonly scan: (
    root: string,
    ignoreGlobs: readonly string[],
  ) => Effect.Effect<readonly string[], GlobError>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class FileScanner extends Context.Tag('FileScanner')<FileScanner, FileScannerShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

export const FileScannerLive = Layer.effect(
  FileScanner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const scan = (
      root: string,
      ignoreGlobs: readonly string[],
    ): Effect.Effect<readonly string[], GlobError> =>
      Effect.gen(function* () {
        // Build the ignore filter instance
        const ig = ignore();

        // Always ignore node_modules (handled by fast-glob ignore option too,
        // but also add it here to be safe with the filter step)
        ig.add('node_modules');

        // Load .gitignore if present
        const gitignorePath = path.join(root, '.gitignore');
        const hasGitignore = yield* fs
          .exists(gitignorePath)
          .pipe(Effect.orElseSucceed(() => false));
        if (hasGitignore) {
          const gitignoreContent = yield* fs
            .readFileString(gitignorePath, 'utf-8')
            .pipe(Effect.orElseSucceed(() => ''));
          ig.add(gitignoreContent);
        }

        // Add custom ignore globs
        if (ignoreGlobs.length > 0) {
          ig.add([...ignoreGlobs]);
        }

        // Use fast-glob to discover source files
        const absoluteFiles = yield* Effect.tryPromise({
          try: () =>
            fg('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
              cwd: root,
              absolute: true,
              onlyFiles: true,
              ignore: ['**/node_modules/**'],
            }),
          catch: (cause) => new GlobError({ cause }),
        });

        // Filter through the ignore instance using relative paths
        const filtered = absoluteFiles.filter((absPath) => {
          const rel = path.relative(root, absPath);
          return !ig.ignores(rel);
        });

        return filtered;
      });

    return { scan };
  }),
);
