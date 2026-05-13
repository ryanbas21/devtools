import { Context, Effect, Layer } from 'effect';
import path from 'node:path';
import type {
  PackageInfo,
  ExportedSymbol,
  ImportedSymbol,
  DeadExport,
  AnalysisResult,
} from './schemas.js';

// ─── Extension stripping ───────────────────────────────────────────────────────

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function stripExtension(filePath: string): string {
  for (const ext of EXTENSIONS) {
    if (filePath.endsWith(ext)) {
      return filePath.slice(0, -ext.length);
    }
  }
  return filePath;
}

/** Map a build-output entry point (e.g. ./dist/index.js) to its likely source path. */
function resolveEntryPointToSource(
  entryPoint: string,
  scannedFiles: Set<string>,
  scannedStripped: Set<string>,
): string | null {
  // If the raw path already matches a scanned file, use it directly.
  if (scannedFiles.has(entryPoint)) return entryPoint;
  const stripped = stripExtension(entryPoint);
  if (scannedStripped.has(stripped)) return stripped;

  // Try mapping common build output dirs to source dirs.
  const buildDirs = ['/dist/', '/build/', '/out/'];
  const sourceDirs = ['/src/', '/src/', '/src/'];

  for (let i = 0; i < buildDirs.length; i++) {
    if (entryPoint.includes(buildDirs[i])) {
      const sourcePath = entryPoint.replace(buildDirs[i], sourceDirs[i]);
      if (scannedFiles.has(sourcePath)) return sourcePath;
      const sourceStripped = stripExtension(sourcePath);
      if (scannedStripped.has(sourceStripped)) return sourceStripped;
    }
  }

  return null;
}

// ─── Service interface ────────────────────────────────────────────────────────

export interface ExportGraphShape {
  readonly analyze: (
    packages: readonly PackageInfo[],
    allExports: Map<string, readonly ExportedSymbol[]>,
    allImports: Map<string, readonly ImportedSymbol[]>,
  ) => Effect.Effect<AnalysisResult>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class ExportGraph extends Context.Tag('ExportGraph')<ExportGraph, ExportGraphShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

function analyzeSync(
  packages: readonly PackageInfo[],
  allExports: Map<string, readonly ExportedSymbol[]>,
  allImports: Map<string, readonly ImportedSymbol[]>,
): AnalysisResult {
  // Step 1: Build set of entry point file paths (resolved to source paths)
  const scannedFiles = new Set(allExports.keys());
  const scannedStripped = new Set<string>();
  for (const f of scannedFiles) scannedStripped.add(stripExtension(f));

  const entryPointPaths = new Set<string>();
  for (const pkg of packages) {
    for (const ep of pkg.entryPoints) {
      const resolved = path.resolve(pkg.root, ep);
      const sourcePath = resolveEntryPointToSource(resolved, scannedFiles, scannedStripped);
      if (sourcePath !== null) {
        entryPointPaths.add(sourcePath);
      }
    }
  }

  // Step 2: Build map of filePath -> package
  const fileToPackage = new Map<string, PackageInfo>();
  for (const pkg of packages) {
    for (const [filePath] of allExports) {
      // A file belongs to a package if its path starts with the package root
      if (filePath.startsWith(pkg.root + path.sep) || filePath === pkg.root) {
        if (!fileToPackage.has(filePath)) {
          fileToPackage.set(filePath, pkg);
        }
      }
    }
  }

  // Step 3: Collect consumed symbols from all imports
  // relative-resolved: Set of `strippedPath:name`
  const consumedByRelative = new Set<string>();
  // package: Set of `packageName:name`
  const consumedByPackage = new Set<string>();
  // namespace: Set of strippedPath (source file) — everything from this file is consumed
  const consumedByNamespace = new Set<string>();

  for (const [importerFile, imports] of allImports) {
    for (const imp of imports) {
      const src = imp.source;
      const isRelative = src.startsWith('./') || src.startsWith('../') || src.startsWith('/');

      if (isRelative) {
        // Resolve relative import to absolute path
        const importerDir = path.dirname(importerFile);
        const resolved = path.resolve(importerDir, src);
        const strippedResolved = stripExtension(resolved);

        if (imp.isNamespace || imp.name === '*') {
          consumedByNamespace.add(strippedResolved);
        } else {
          consumedByRelative.add(`${strippedResolved}:${imp.name}`);
        }
      } else {
        // Package import — use source as-is (package name)
        if (imp.isNamespace || imp.name === '*') {
          // namespace import of a package: track as namespace
          consumedByNamespace.add(src);
        } else {
          consumedByPackage.add(`${src}:${imp.name}`);
        }
      }
    }
  }

  // Step 3b: Treat re-exports as import edges
  // If file A re-exports { foo } from './bar', that means bar's `foo` is consumed.
  // This applies to ALL files, not just entry points, so multi-hop chains work.
  for (const [filePath, exports] of allExports) {
    for (const exp of exports) {
      if (!exp.isReExport || !exp.reExportSource) continue;

      const reExportSource = exp.reExportSource;
      // Skip package specifiers — path.resolve would produce nonsense
      const isRelative =
        reExportSource.startsWith('./') ||
        reExportSource.startsWith('../') ||
        reExportSource.startsWith('/');
      if (!isRelative) continue;

      const dir = path.dirname(filePath);
      const resolved = stripExtension(path.resolve(dir, reExportSource));

      if (exp.name === '*') {
        consumedByNamespace.add(resolved);
      } else {
        // For renamed re-exports (export { foo as bar }), consume the local name
        const consumedName = exp.reExportLocalName ?? exp.name;
        consumedByRelative.add(`${resolved}:${consumedName}`);
      }
    }
  }

  // Step 4: Determine dead exports
  const deadExports: DeadExport[] = [];
  const warnings: string[] = [];
  let totalExports = 0;
  const totalFiles = allExports.size;

  for (const [filePath, exports] of allExports) {
    // Skip entry point files — their exports are always safe
    if (entryPointPaths.has(filePath)) {
      totalExports += exports.length;
      continue;
    }

    const pkg = fileToPackage.get(filePath);
    if (pkg === undefined) {
      // File doesn't belong to any known package — skip silently
      totalExports += exports.length;
      continue;
    }

    const strippedFilePath = stripExtension(filePath);

    for (const exp of exports) {
      totalExports++;

      // Skip star re-exports (export * from '...')
      if (exp.name === '*') continue;

      // Check if consumed by a relative import
      const relKey = `${strippedFilePath}:${exp.name}`;
      if (consumedByRelative.has(relKey)) continue;

      // Check if consumed by a package import
      const pkgKey = `${pkg.name}:${exp.name}`;
      if (consumedByPackage.has(pkgKey)) continue;

      // Check if source file is consumed by a namespace import
      if (consumedByNamespace.has(strippedFilePath)) continue;
      if (consumedByNamespace.has(pkg.name)) continue;

      // Not consumed — dead export
      deadExports.push({ symbol: exp, packageName: pkg.name });
    }
  }

  return {
    deadExports,
    totalExports,
    totalFiles,
    warnings,
  };
}

export const ExportGraphLive = Layer.succeed(ExportGraph, {
  analyze: (packages, allExports, allImports) =>
    Effect.sync(() => analyzeSync(packages, allExports, allImports)),
});
