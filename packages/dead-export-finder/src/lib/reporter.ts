import { Context, Layer, Array as Arr, Order, pipe } from 'effect';
import path from 'node:path';
import type { AnalysisResult, DeadExport } from './schemas.js';

// ─── Pure formatting helpers ─────────────────────────────────────────────────

const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;

const formatFileSection = (
  filePath: string,
  fileExports: ReadonlyArray<DeadExport>,
  pkgRoot: string,
): ReadonlyArray<string> => {
  const relPath = pkgRoot ? path.relative(pkgRoot, filePath) : filePath;
  const sorted = pipe(
    fileExports,
    Arr.sort(Order.mapInput(Order.number, (d: DeadExport) => d.symbol.line)),
  );

  return [
    `  ${relPath}`,
    ...pipe(
      sorted,
      Arr.map((dead) => `    :${String(dead.symbol.line).padEnd(4)} ${dead.symbol.name}`),
    ),
  ];
};

const formatPackageSection = (
  pkgName: string,
  pkgDeadExports: ReadonlyArray<DeadExport>,
  packageRoots: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const pkgRoot = packageRoots.get(pkgName) ?? '';
  const count = pkgDeadExports.length;
  const exportWord = pluralize(count, 'dead export', 'dead exports');

  const byFile = pipe(
    pkgDeadExports,
    Arr.groupBy((dead) => dead.symbol.filePath),
  );

  const sortedFiles = pipe(Object.keys(byFile), Arr.sort(Order.string));

  return [
    `${pkgName} (${count} ${exportWord})`,
    ...pipe(
      sortedFiles,
      Arr.flatMap((filePath) => formatFileSection(filePath, byFile[filePath]!, pkgRoot)),
    ),
    '',
  ];
};

const formatReport = (
  result: AnalysisResult,
  packageRoots: ReadonlyMap<string, string>,
): string => {
  const { deadExports, totalExports, totalFiles } = result;

  if (deadExports.length === 0) {
    return `No dead exports found. Scanned ${totalExports} exports across ${totalFiles} files.`;
  }

  const byPackage = pipe(
    deadExports,
    Arr.groupBy((dead) => dead.packageName),
  );

  const sortedPackages = pipe(Object.keys(byPackage), Arr.sort(Order.string));

  const header: ReadonlyArray<string> = ['Dead Export Report', '══════════════════', ''];

  const packageSections = pipe(
    sortedPackages,
    Arr.flatMap((pkgName) => formatPackageSection(pkgName, byPackage[pkgName]!, packageRoots)),
  );

  const totalDead = deadExports.length;
  const pkgCount = sortedPackages.length;
  const deadWord = pluralize(totalDead, 'dead export', 'dead exports');
  const pkgWord = pluralize(pkgCount, 'package', 'packages');

  const summary: ReadonlyArray<string> = [
    '────────────────────────────',
    `Summary: ${totalDead} ${deadWord} across ${pkgCount} ${pkgWord}`,
  ];

  return pipe(header, Arr.appendAll(packageSections), Arr.appendAll(summary), Arr.join('\n'));
};

// ─── Service interface ────────────────────────────────────────────────────────

export interface ReporterShape {
  readonly format: (result: AnalysisResult, packageRoots: ReadonlyMap<string, string>) => string;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class Reporter extends Context.Tag('Reporter')<Reporter, ReporterShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

export const ReporterLive = Layer.succeed(Reporter, {
  format: formatReport,
});
