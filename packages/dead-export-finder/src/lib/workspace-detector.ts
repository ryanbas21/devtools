import { Context, Data, Effect, Layer, Array as Arr, Option, pipe } from 'effect';
import { FileSystem, Path } from '@effect/platform';
import fg from 'fast-glob';
import YAML from 'yaml';
import type { PackageInfo, WorkspaceType } from './schemas.js';
import { WorkspaceNotFoundError } from './errors.js';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface WorkspaceResult {
  readonly type: WorkspaceType;
  readonly root: string;
  readonly packages: readonly PackageInfo[];
}

// ─── Service interface ────────────────────────────────────────────────────────

export interface WorkspaceDetectorShape {
  readonly detect: (cwd: string) => Effect.Effect<WorkspaceResult, WorkspaceNotFoundError>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class WorkspaceDetector extends Context.Tag('WorkspaceDetector')<
  WorkspaceDetector,
  WorkspaceDetectorShape
>() {}

// ─── Internal errors ──────────────────────────────────────────────────────────

class GlobError extends Data.TaggedError('GlobError')<{
  readonly cause: unknown;
}> {}

// ─── Pure helpers ────────────────────────────────────────────────────────────

const collectExportsStrings = (value: unknown): ReadonlyArray<string> => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return pipe(value, Arr.flatMap(collectExportsStrings));
  if (value !== null && typeof value === 'object') {
    return pipe(
      Object.values(value as Record<string, unknown>),
      Arr.flatMap(collectExportsStrings),
    );
  }
  return [];
};

const extractEntryPoints = (pkg: Record<string, unknown>): ReadonlyArray<string> => {
  if (pkg['exports'] !== undefined) {
    return pipe(collectExportsStrings(pkg['exports']), Arr.dedupe);
  }

  return pipe(
    ['main', 'module', 'types'] as const,
    Arr.filterMap((field) => {
      const val = pkg[field];
      return typeof val === 'string' ? Option.some(val) : Option.none();
    }),
    Arr.dedupe,
  );
};

const readPackageInfo = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  pkgDir: string,
): Effect.Effect<PackageInfo | null> => {
  const pkgPath = pathSvc.join(pkgDir, 'package.json');

  return pipe(
    fs.exists(pkgPath),
    Effect.flatMap((exists) => {
      if (!exists) return Effect.succeed(null);
      return pipe(
        fs.readFileString(pkgPath, 'utf-8'),
        Effect.map((contents): PackageInfo | null => {
          try {
            const parsed = JSON.parse(contents) as Record<string, unknown>;
            const name =
              typeof parsed['name'] === 'string' ? parsed['name'] : pathSvc.basename(pkgDir);
            const entryPoints = extractEntryPoints(parsed);
            return { name, root: pkgDir, entryPoints: [...entryPoints] } as PackageInfo;
          } catch {
            return null;
          }
        }),
        Effect.catchAll(() => Effect.succeed(null)),
      );
    }),
    Effect.catchAll(() => Effect.succeed(null)),
  );
};

const resolveWorkspaceGlobs = (
  pathSvc: Path.Path,
  root: string,
  globs: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, GlobError> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        fg(
          pipe(
            globs,
            Arr.map((g) => `${g}/package.json`),
          ),
          { cwd: root, absolute: true, onlyFiles: true },
        ),
      catch: (cause) => new GlobError({ cause }),
    }),
    Effect.map((files) =>
      pipe(
        files,
        Arr.map((p) => pathSvc.dirname(p)),
      ),
    ),
  );

const readPkgDirs = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  root: string,
  globs: ReadonlyArray<string>,
): Effect.Effect<readonly PackageInfo[]> =>
  pipe(
    resolveWorkspaceGlobs(pathSvc, root, globs),
    Effect.flatMap((dirs) =>
      Effect.all(
        pipe(
          dirs,
          Arr.map((d) => readPackageInfo(fs, pathSvc, d)),
        ),
      ),
    ),
    Effect.map((infos) =>
      pipe(
        infos,
        Arr.filter((p): p is PackageInfo => p !== null),
      ),
    ),
    Effect.catchTag('GlobError', () => Effect.succeed([] as PackageInfo[])),
  );

// ─── Workspace detection strategies ─────────────────────────────────────────

const extractWorkspaceGlobs = (workspaces: unknown): ReadonlyArray<string> => {
  if (Array.isArray(workspaces)) {
    return pipe(
      workspaces,
      Arr.filter((g): g is string => typeof g === 'string'),
    );
  }
  if (typeof workspaces === 'object' && workspaces !== null) {
    const obj = workspaces as { packages?: unknown };
    if (Array.isArray(obj.packages)) {
      return pipe(
        obj.packages,
        Arr.filter((g): g is string => typeof g === 'string'),
      );
    }
  }
  return [];
};

const detectPnpm = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  cwd: string,
): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> =>
  pipe(
    fs.exists(pathSvc.join(cwd, 'pnpm-workspace.yaml')),
    Effect.orDie,
    Effect.flatMap((exists) =>
      exists
        ? pipe(
            fs.readFileString(pathSvc.join(cwd, 'pnpm-workspace.yaml'), 'utf-8'),
            Effect.orDie,
            Effect.map((raw) => {
              const parsed = YAML.parse(raw) as { packages?: string[] } | null;
              return parsed?.packages ?? [];
            }),
            Effect.flatMap((globs) => readPkgDirs(fs, pathSvc, cwd, globs)),
            Effect.map(
              (packages): WorkspaceResult => ({
                type: 'pnpm' as WorkspaceType,
                root: cwd,
                packages,
              }),
            ),
          )
        : Effect.fail(new WorkspaceNotFoundError({ cwd })),
    ),
  );

const detectNpmWorkspaces = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  cwd: string,
  rootPkg: Record<string, unknown>,
): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> => {
  const globs = extractWorkspaceGlobs(rootPkg['workspaces']);
  return globs.length > 0
    ? pipe(
        readPkgDirs(fs, pathSvc, cwd, globs),
        Effect.map(
          (packages): WorkspaceResult => ({
            type: 'npm' as WorkspaceType,
            root: cwd,
            packages,
          }),
        ),
      )
    : Effect.fail(new WorkspaceNotFoundError({ cwd }));
};

const detectNx = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  cwd: string,
): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> =>
  pipe(
    fs.exists(pathSvc.join(cwd, 'nx.json')),
    Effect.orDie,
    Effect.flatMap((exists) =>
      exists
        ? pipe(
            readPkgDirs(fs, pathSvc, cwd, ['packages/*', 'libs/*', 'apps/*']),
            Effect.flatMap((packages) =>
              packages.length > 0
                ? Effect.succeed({
                    type: 'nx' as WorkspaceType,
                    root: cwd,
                    packages,
                  } as WorkspaceResult)
                : Effect.fail(new WorkspaceNotFoundError({ cwd })),
            ),
          )
        : Effect.fail(new WorkspaceNotFoundError({ cwd })),
    ),
  );

const detectTurbo = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  cwd: string,
): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> =>
  pipe(
    fs.exists(pathSvc.join(cwd, 'turbo.json')),
    Effect.orDie,
    Effect.flatMap((exists) =>
      exists
        ? pipe(
            readPkgDirs(fs, pathSvc, cwd, ['packages/*', 'apps/*']),
            Effect.flatMap((packages) =>
              packages.length > 0
                ? Effect.succeed({
                    type: 'turborepo' as WorkspaceType,
                    root: cwd,
                    packages,
                  } as WorkspaceResult)
                : Effect.fail(new WorkspaceNotFoundError({ cwd })),
            ),
          )
        : Effect.fail(new WorkspaceNotFoundError({ cwd })),
    ),
  );

const detectSingle = (
  fs: FileSystem.FileSystem,
  pathSvc: Path.Path,
  cwd: string,
): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> =>
  pipe(
    readPackageInfo(fs, pathSvc, cwd),
    Effect.flatMap((pkg) =>
      pkg !== null
        ? Effect.succeed({
            type: 'single' as WorkspaceType,
            root: cwd,
            packages: [pkg],
          } as WorkspaceResult)
        : Effect.fail(new WorkspaceNotFoundError({ cwd })),
    ),
  );

// ─── Live implementation ──────────────────────────────────────────────────────

export const WorkspaceDetectorLive = Layer.effect(
  WorkspaceDetector,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathSvc = yield* Path.Path;

    const detect = (cwd: string): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> =>
      pipe(
        detectPnpm(fs, pathSvc, cwd),
        Effect.catchTag('WorkspaceNotFoundError', () =>
          pipe(
            fs.exists(pathSvc.join(cwd, 'package.json')),
            Effect.orDie,
            Effect.flatMap((hasRootPkg) => {
              if (!hasRootPkg) return Effect.fail(new WorkspaceNotFoundError({ cwd }));

              return pipe(
                fs.readFileString(pathSvc.join(cwd, 'package.json'), 'utf-8'),
                Effect.orDie,
                Effect.flatMap((raw) =>
                  Effect.try({
                    try: () => JSON.parse(raw) as Record<string, unknown>,
                    catch: () => new WorkspaceNotFoundError({ cwd }),
                  }),
                ),
                Effect.flatMap((rootPkg) =>
                  pipe(
                    detectNpmWorkspaces(fs, pathSvc, cwd, rootPkg),
                    Effect.catchTag('WorkspaceNotFoundError', () => detectNx(fs, pathSvc, cwd)),
                    Effect.catchTag('WorkspaceNotFoundError', () => detectTurbo(fs, pathSvc, cwd)),
                    Effect.catchTag('WorkspaceNotFoundError', () => detectSingle(fs, pathSvc, cwd)),
                  ),
                ),
              );
            }),
          ),
        ),
      );

    return { detect };
  }),
);
