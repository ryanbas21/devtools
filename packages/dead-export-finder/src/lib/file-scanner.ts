import { Context, Data, Effect, Layer, Array as Arr, pipe } from 'effect';
import { FileSystem, Path } from '@effect/platform';
import fg from 'fast-glob';
import ignore from 'ignore';

// ─── Internal errors ──────────────────────────────────────────────────────────

class GlobError extends Data.TaggedError('GlobError')<{
  readonly cause: unknown;
}> {}

// ─── Pure helpers ────────────────────────────────────────────────────────────

const loadGitignoreAt = (
  fs: FileSystem.FileSystem,
  gitignorePath: string,
): Effect.Effect<ReadonlyArray<string>> =>
  pipe(
    fs.exists(gitignorePath),
    Effect.orElseSucceed(() => false),
    Effect.flatMap((exists) =>
      exists
        ? pipe(
            fs.readFileString(gitignorePath, 'utf-8'),
            Effect.orElseSucceed(() => ''),
            Effect.map((content) => content.split('\n')),
          )
        : Effect.succeed([] as ReadonlyArray<string>),
    ),
  );

const loadGitignorePatterns = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  root: string,
  workspaceRoot: string | undefined,
): Effect.Effect<ReadonlyArray<string>> => {
  const dirs = [root];
  if (workspaceRoot !== undefined && workspaceRoot !== root) {
    // Walk from package root up to workspace root, collecting .gitignore files
    let current = pathSvc.dirname(root);
    while (current.length >= workspaceRoot.length && current !== pathSvc.dirname(current)) {
      dirs.push(current);
      if (current === workspaceRoot) break;
      current = pathSvc.dirname(current);
    }
  }

  return pipe(
    dirs,
    Arr.map((dir) => loadGitignoreAt(fs, pathSvc.join(dir, '.gitignore'))),
    (effects) => Effect.all(effects),
    Effect.map(Arr.flatten),
  );
};

const DEFAULT_IGNORE: ReadonlyArray<string> = [
  'node_modules',
  '*.config.ts',
  '*.config.mjs',
  '*.config.cjs',
  '*.config.js',
];

const buildIgnorePatterns = (
  gitignorePatterns: ReadonlyArray<string>,
  customGlobs: readonly string[],
): ReadonlyArray<string> =>
  pipe(DEFAULT_IGNORE, Arr.appendAll(gitignorePatterns), Arr.appendAll(customGlobs));

const discoverFiles = (root: string): Effect.Effect<ReadonlyArray<string>, GlobError> =>
  Effect.tryPromise({
    try: () =>
      fg('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
        cwd: root,
        absolute: true,
        onlyFiles: true,
        ignore: ['**/node_modules/**'],
      }),
    catch: (cause) => new GlobError({ cause }),
  });

const filterWithIgnore = (
  files: ReadonlyArray<string>,
  patterns: ReadonlyArray<string>,
  pathSvc: Path.Path,
  root: string,
): ReadonlyArray<string> => {
  const ig = ignore();
  ig.add([...patterns]);

  return pipe(
    files,
    Arr.filter((absPath) => {
      const rel = pathSvc.relative(root, absPath);
      return !ig.ignores(rel);
    }),
  );
};

// ─── Service interface ────────────────────────────────────────────────────────

export interface FileScannerShape {
  readonly scan: (
    root: string,
    ignoreGlobs: readonly string[],
    workspaceRoot?: string,
  ) => Effect.Effect<readonly string[], GlobError>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class FileScanner extends Context.Tag('FileScanner')<FileScanner, FileScannerShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

export const FileScannerLive = Layer.effect(
  FileScanner,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathSvc = yield* Path.Path;

    const scan = (
      root: string,
      ignoreGlobs: readonly string[],
      workspaceRoot?: string,
    ): Effect.Effect<readonly string[], GlobError> =>
      pipe(
        loadGitignorePatterns(fs, pathSvc, root, workspaceRoot),
        Effect.map((gitignorePatterns) => buildIgnorePatterns(gitignorePatterns, ignoreGlobs)),
        Effect.flatMap((patterns) =>
          pipe(
            discoverFiles(root),
            Effect.map((files) => filterWithIgnore(files, patterns, pathSvc, root)),
          ),
        ),
      );

    return { scan };
  }),
);
