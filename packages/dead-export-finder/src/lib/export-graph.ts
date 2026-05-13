import { Context, Effect, Layer, Array as Arr, HashSet, Option, pipe } from 'effect';
import path from 'node:path';
import type {
  PackageInfo,
  ExportedSymbol,
  ImportedSymbol,
  DeadExport,
  AnalysisResult,
} from './schemas.js';

// ─── Extension stripping ───────────────────────────────────────────────────────

const EXTENSIONS: ReadonlyArray<string> = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const stripExtension = (filePath: string): string =>
  pipe(
    EXTENSIONS,
    Arr.findFirst((ext) => filePath.endsWith(ext)),
    (opt) => (opt._tag === 'Some' ? filePath.slice(0, -opt.value.length) : filePath),
  );

const BUILD_DIR_MAPPINGS: ReadonlyArray<readonly [string, string]> = [
  ['/dist/', '/src/'],
  ['/build/', '/src/'],
  ['/out/', '/src/'],
];

const resolveEntryPointToSource = (
  entryPoint: string,
  scannedFiles: HashSet.HashSet<string>,
  scannedStripped: HashSet.HashSet<string>,
): string | null => {
  if (HashSet.has(scannedFiles, entryPoint)) return entryPoint;
  const stripped = stripExtension(entryPoint);
  if (HashSet.has(scannedStripped, stripped)) return stripped;

  return pipe(
    BUILD_DIR_MAPPINGS,
    Arr.findFirst(([buildDir]) => entryPoint.includes(buildDir)),
    (opt) => {
      if (opt._tag === 'None') return null;
      const [buildDir, sourceDir] = opt.value;
      const sourcePath = entryPoint.replace(buildDir, sourceDir);
      if (HashSet.has(scannedFiles, sourcePath)) return sourcePath;
      const sourceStripped = stripExtension(sourcePath);
      if (HashSet.has(scannedStripped, sourceStripped)) return sourceStripped;
      return null;
    },
  );
};

// ─── Pure pipeline stages ────────────────────────────────────────────────────

const resolveEntryPoints = (
  packages: ReadonlyArray<PackageInfo>,
  scannedFiles: HashSet.HashSet<string>,
  scannedStripped: HashSet.HashSet<string>,
): HashSet.HashSet<string> =>
  pipe(
    packages,
    Arr.flatMap((pkg) =>
      pipe(
        pkg.entryPoints,
        Arr.filterMap((ep) => {
          const resolved = path.resolve(pkg.root, ep);
          const sourcePath = resolveEntryPointToSource(resolved, scannedFiles, scannedStripped);
          return sourcePath !== null ? Option.some(sourcePath) : Option.none();
        }),
      ),
    ),
    HashSet.fromIterable,
  );

const buildFileToPackageMap = (
  packages: ReadonlyArray<PackageInfo>,
  exportedFilePaths: ReadonlyArray<string>,
): ReadonlyMap<string, PackageInfo> =>
  new Map(
    pipe(
      exportedFilePaths,
      Arr.filterMap((filePath) => {
        const pkg = pipe(
          packages,
          Arr.findFirst((p) => filePath.startsWith(p.root + path.sep) || filePath === p.root),
        );
        return pkg._tag === 'Some' ? Option.some([filePath, pkg.value] as const) : Option.none();
      }),
    ),
  );

// ─── Consumed sets ──────────────────────────────────────────────────────────

interface ConsumedSets {
  readonly byRelative: HashSet.HashSet<string>;
  readonly byPackage: HashSet.HashSet<string>;
  readonly byNamespace: HashSet.HashSet<string>;
}

const isRelativePath = (src: string): boolean =>
  src.startsWith('./') || src.startsWith('../') || src.startsWith('/');

const collectImportEdges = (
  allImports: ReadonlyMap<string, readonly ImportedSymbol[]>,
): ConsumedSets => {
  const entries = pipe(
    [...allImports.entries()],
    Arr.flatMap(([importerFile, imports]) =>
      pipe(
        imports,
        Arr.map((imp) => ({ importerFile, imp })),
      ),
    ),
  );

  const relativeEntries = pipe(
    entries,
    Arr.filter(({ imp }) => isRelativePath(imp.source)),
  );

  const packageEntries = pipe(
    entries,
    Arr.filter(({ imp }) => !isRelativePath(imp.source)),
  );

  const byRelative = pipe(
    relativeEntries,
    Arr.filter(({ imp }) => !imp.isNamespace && imp.name !== '*'),
    Arr.map(({ importerFile, imp }) => {
      const importerDir = path.dirname(importerFile);
      const resolved = stripExtension(path.resolve(importerDir, imp.source));
      return `${resolved}:${imp.name}`;
    }),
    HashSet.fromIterable,
  );

  const byPackage = pipe(
    packageEntries,
    Arr.filter(({ imp }) => !imp.isNamespace && imp.name !== '*'),
    Arr.map(({ imp }) => `${imp.source}:${imp.name}`),
    HashSet.fromIterable,
  );

  const relativeNamespaces = pipe(
    relativeEntries,
    Arr.filter(({ imp }) => imp.isNamespace || imp.name === '*'),
    Arr.map(({ importerFile, imp }) => {
      const importerDir = path.dirname(importerFile);
      return stripExtension(path.resolve(importerDir, imp.source));
    }),
  );

  const packageNamespaces = pipe(
    packageEntries,
    Arr.filter(({ imp }) => imp.isNamespace || imp.name === '*'),
    Arr.map(({ imp }) => imp.source),
  );

  const byNamespace = pipe([...relativeNamespaces, ...packageNamespaces], HashSet.fromIterable);

  return { byRelative, byPackage, byNamespace };
};

const collectReExportEdges = (
  allExports: ReadonlyMap<string, readonly ExportedSymbol[]>,
): ConsumedSets => {
  const reExports = pipe(
    [...allExports.entries()],
    Arr.flatMap(([filePath, exports]) =>
      pipe(
        exports,
        Arr.filter((exp) => exp.isReExport && exp.reExportSource !== undefined),
        Arr.filter((exp) => isRelativePath(exp.reExportSource!)),
        Arr.map((exp) => ({ filePath, exp })),
      ),
    ),
  );

  const byNamespace = pipe(
    reExports,
    Arr.filter(({ exp }) => exp.name === '*'),
    Arr.map(({ filePath, exp }) => {
      const dir = path.dirname(filePath);
      return stripExtension(path.resolve(dir, exp.reExportSource!));
    }),
    HashSet.fromIterable,
  );

  const byRelative = pipe(
    reExports,
    Arr.filter(({ exp }) => exp.name !== '*'),
    Arr.map(({ filePath, exp }) => {
      const dir = path.dirname(filePath);
      const resolved = stripExtension(path.resolve(dir, exp.reExportSource!));
      const consumedName = exp.reExportLocalName ?? exp.name;
      return `${resolved}:${consumedName}`;
    }),
    HashSet.fromIterable,
  );

  return {
    byRelative,
    byPackage: HashSet.empty<string>(),
    byNamespace,
  };
};

const mergeConsumedSets = (a: ConsumedSets, b: ConsumedSets): ConsumedSets => ({
  byRelative: HashSet.union(a.byRelative, b.byRelative),
  byPackage: HashSet.union(a.byPackage, b.byPackage),
  byNamespace: HashSet.union(a.byNamespace, b.byNamespace),
});

const buildConsumedSets = (
  allImports: ReadonlyMap<string, readonly ImportedSymbol[]>,
  allExports: ReadonlyMap<string, readonly ExportedSymbol[]>,
): ConsumedSets =>
  mergeConsumedSets(collectImportEdges(allImports), collectReExportEdges(allExports));

// ─── Dead export detection ──────────────────────────────────────────────────

const isConsumed = (
  exp: ExportedSymbol,
  strippedFilePath: string,
  pkg: PackageInfo,
  consumed: ConsumedSets,
): boolean => {
  if (exp.name === '*') return true;
  if (HashSet.has(consumed.byRelative, `${strippedFilePath}:${exp.name}`)) return true;
  if (HashSet.has(consumed.byPackage, `${pkg.name}:${exp.name}`)) return true;
  if (HashSet.has(consumed.byNamespace, strippedFilePath)) return true;
  if (HashSet.has(consumed.byNamespace, pkg.name)) return true;
  return false;
};

const findDeadExports = (
  allExports: ReadonlyMap<string, readonly ExportedSymbol[]>,
  entryPoints: HashSet.HashSet<string>,
  fileToPackage: ReadonlyMap<string, PackageInfo>,
  consumed: ConsumedSets,
): ReadonlyArray<DeadExport> =>
  pipe(
    [...allExports.entries()],
    Arr.filter(([filePath]) => !HashSet.has(entryPoints, filePath)),
    Arr.flatMap(([filePath, exports]) => {
      const pkg = fileToPackage.get(filePath);
      if (pkg === undefined) return [];

      const strippedFilePath = stripExtension(filePath);

      return pipe(
        exports,
        Arr.filter((exp) => !isConsumed(exp, strippedFilePath, pkg, consumed)),
        Arr.map((exp): DeadExport => ({ symbol: exp, packageName: pkg.name })),
      );
    }),
  );

const countTotalExports = (allExports: ReadonlyMap<string, readonly ExportedSymbol[]>): number =>
  pipe(
    [...allExports.values()],
    Arr.map((exports) => exports.length),
    Arr.reduce(0, (acc, n) => acc + n),
  );

// ─── Service interface ────────────────────────────────────────────────────────

export interface ExportGraphShape {
  readonly analyze: (
    packages: readonly PackageInfo[],
    allExports: ReadonlyMap<string, readonly ExportedSymbol[]>,
    allImports: ReadonlyMap<string, readonly ImportedSymbol[]>,
  ) => Effect.Effect<AnalysisResult>;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class ExportGraph extends Context.Tag('ExportGraph')<ExportGraph, ExportGraphShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

const analyze = (
  packages: readonly PackageInfo[],
  allExports: ReadonlyMap<string, readonly ExportedSymbol[]>,
  allImports: ReadonlyMap<string, readonly ImportedSymbol[]>,
): AnalysisResult => {
  const scannedFiles = HashSet.fromIterable(allExports.keys());
  const scannedStripped = pipe(
    [...allExports.keys()],
    Arr.map(stripExtension),
    HashSet.fromIterable,
  );

  const entryPoints = resolveEntryPoints(packages, scannedFiles, scannedStripped);
  const fileToPackage = buildFileToPackageMap(packages, [...allExports.keys()]);
  const consumed = buildConsumedSets(allImports, allExports);
  const deadExports = findDeadExports(allExports, entryPoints, fileToPackage, consumed);

  return {
    deadExports: [...deadExports],
    totalExports: countTotalExports(allExports),
    totalFiles: allExports.size,
    warnings: [],
  };
};

export const ExportGraphLive = Layer.succeed(ExportGraph, {
  analyze: (packages, allExports, allImports) =>
    Effect.sync(() => analyze(packages, allExports, allImports)),
});
