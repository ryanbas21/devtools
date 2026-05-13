import { Context, Data, Effect, Layer } from 'effect';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk an exports field value and collect all string leaf values.
 * Handles: string, string[], nested condition/subpath objects.
 */
function collectExportsStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectExportsStrings);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectExportsStrings);
  }
  return [];
}

/**
 * Extract entry points from a parsed package.json object.
 * Prefers `exports` field (all string leaves), falls back to main/module/types.
 */
function extractEntryPoints(pkg: Record<string, unknown>): string[] {
  if (pkg['exports'] !== undefined) {
    const collected = collectExportsStrings(pkg['exports']);
    return [...new Set(collected)];
  }

  const fallbacks: string[] = [];
  for (const field of ['main', 'module', 'types'] as const) {
    const val = pkg[field];
    if (typeof val === 'string') fallbacks.push(val);
  }
  return [...new Set(fallbacks)];
}

/**
 * Read and parse a package.json, returning a PackageInfo.
 * Absorbs all errors and returns null when the file is missing or unparseable.
 */
const readPackageInfo = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  pkgDir: string,
): Effect.Effect<PackageInfo | null> => {
  const pkgPath = path.join(pkgDir, 'package.json');

  return fs.exists(pkgPath).pipe(
    Effect.flatMap((exists) => {
      if (!exists) return Effect.succeed(null);
      return fs.readFileString(pkgPath, 'utf-8').pipe(
        Effect.map((contents) => {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(contents) as Record<string, unknown>;
          } catch {
            return null;
          }
          const name = typeof parsed['name'] === 'string' ? parsed['name'] : path.basename(pkgDir);
          const entryPoints = extractEntryPoints(parsed);
          return { name, root: pkgDir, entryPoints } as PackageInfo;
        }),
        Effect.catchAll(() => Effect.succeed(null)),
      );
    }),
    Effect.catchAll(() => Effect.succeed(null)),
  );
};

/**
 * Resolve workspace glob patterns (e.g. "packages/*") relative to root,
 * then return all directories containing a package.json.
 */
const resolveWorkspaceGlobs = (
  path: Path.Path,
  root: string,
  globs: string[],
): Effect.Effect<string[], GlobError> =>
  Effect.tryPromise({
    try: () =>
      fg(
        globs.map((g) => `${g}/package.json`),
        { cwd: root, absolute: true, onlyFiles: true },
      ),
    catch: (cause) => new GlobError({ cause }),
  }).pipe(Effect.map((files) => files.map((p) => path.dirname(p))));

// ─── Live implementation ──────────────────────────────────────────────────────

export const WorkspaceDetectorLive = Layer.effect(
  WorkspaceDetector,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const readPkgDirs = (root: string, globs: string[]): Effect.Effect<readonly PackageInfo[]> =>
      resolveWorkspaceGlobs(path, root, globs).pipe(
        Effect.flatMap((dirs) => Effect.all(dirs.map((d) => readPackageInfo(fs, path, d)))),
        Effect.map((infos) => infos.filter((p): p is PackageInfo => p !== null)),
        Effect.catchTag('GlobError', () => Effect.succeed([] as PackageInfo[])),
      );

    const detect = (cwd: string): Effect.Effect<WorkspaceResult, WorkspaceNotFoundError> =>
      Effect.gen(function* () {
        // 1. Check for pnpm-workspace.yaml
        const pnpmYamlPath = path.join(cwd, 'pnpm-workspace.yaml');
        const hasPnpmYaml = yield* fs.exists(pnpmYamlPath).pipe(Effect.orDie);

        if (hasPnpmYaml) {
          const raw = yield* fs.readFileString(pnpmYamlPath, 'utf-8').pipe(Effect.orDie);
          const parsed = YAML.parse(raw) as { packages?: string[] } | null;
          const globs = parsed?.packages ?? [];
          const packages = yield* readPkgDirs(cwd, globs);
          return { type: 'pnpm' as WorkspaceType, root: cwd, packages };
        }

        // 2. Check for package.json with workspaces field
        const rootPkgPath = path.join(cwd, 'package.json');
        const hasRootPkg = yield* fs.exists(rootPkgPath).pipe(Effect.orDie);

        if (hasRootPkg) {
          const raw = yield* fs.readFileString(rootPkgPath, 'utf-8').pipe(Effect.orDie);
          const rootPkg = yield* Effect.try({
            try: () => JSON.parse(raw) as Record<string, unknown>,
            catch: () => new WorkspaceNotFoundError({ cwd }),
          });

          // npm / yarn workspaces
          const workspaces = rootPkg['workspaces'];
          if (Array.isArray(workspaces) && workspaces.length > 0) {
            const globs = workspaces.filter((g): g is string => typeof g === 'string');
            const packages = yield* readPkgDirs(cwd, globs);
            return { type: 'npm' as WorkspaceType, root: cwd, packages };
          }

          // 3. Check for nx.json
          const nxJsonPath = path.join(cwd, 'nx.json');
          const hasNxJson = yield* fs.exists(nxJsonPath).pipe(Effect.orDie);
          if (hasNxJson) {
            const packages = yield* readPkgDirs(cwd, ['packages/*', 'libs/*', 'apps/*']);
            if (packages.length > 0) {
              return { type: 'nx' as WorkspaceType, root: cwd, packages };
            }
          }

          // 4. Check for turbo.json
          const turboJsonPath = path.join(cwd, 'turbo.json');
          const hasTurboJson = yield* fs.exists(turboJsonPath).pipe(Effect.orDie);
          if (hasTurboJson) {
            const packages = yield* readPkgDirs(cwd, ['packages/*', 'apps/*']);
            if (packages.length > 0) {
              return { type: 'turborepo' as WorkspaceType, root: cwd, packages };
            }
          }

          // 5. Single package fallback
          const singlePkg = yield* readPackageInfo(fs, path, cwd);
          if (singlePkg !== null) {
            return { type: 'single' as WorkspaceType, root: cwd, packages: [singlePkg] };
          }
        }

        // 6. No package.json at cwd — workspace cannot be determined
        return yield* new WorkspaceNotFoundError({ cwd });
      });

    return { detect };
  }),
);
