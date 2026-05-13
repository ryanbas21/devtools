import { Context, Layer } from 'effect';
import path from 'node:path';
import type { AnalysisResult } from './schemas.js';

// ─── Service interface ────────────────────────────────────────────────────────

export interface ReporterShape {
  readonly format: (result: AnalysisResult, packageRoots: ReadonlyMap<string, string>) => string;
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

export class Reporter extends Context.Tag('Reporter')<Reporter, ReporterShape>() {}

// ─── Live implementation ──────────────────────────────────────────────────────

function formatImpl(result: AnalysisResult, packageRoots: ReadonlyMap<string, string>): string {
  const { deadExports, totalExports, totalFiles } = result;

  if (deadExports.length === 0) {
    return `No dead exports found. Scanned ${totalExports} exports across ${totalFiles} files.`;
  }

  // Group by package name
  const byPackage = new Map<string, typeof deadExports>();
  for (const dead of deadExports) {
    const list = byPackage.get(dead.packageName) ?? [];
    byPackage.set(dead.packageName, [...list, dead]);
  }

  const sortedPackages = [...byPackage.keys()].sort();

  const lines: string[] = [];

  // Header
  lines.push('Dead Export Report');
  lines.push('══════════════════');
  lines.push('');

  for (const pkgName of sortedPackages) {
    const pkgDeadExports = byPackage.get(pkgName)!;
    const pkgRoot = packageRoots.get(pkgName) ?? '';

    const count = pkgDeadExports.length;
    const exportWord = count === 1 ? 'dead export' : 'dead exports';
    lines.push(`${pkgName} (${count} ${exportWord})`);

    // Group by file path within package
    const byFile = new Map<string, typeof pkgDeadExports>();
    for (const dead of pkgDeadExports) {
      const filePath = dead.symbol.filePath;
      const list = byFile.get(filePath) ?? [];
      byFile.set(filePath, [...list, dead]);
    }

    const sortedFiles = [...byFile.keys()].sort();

    for (const filePath of sortedFiles) {
      const fileExports = byFile.get(filePath)!;
      const relPath = pkgRoot ? path.relative(pkgRoot, filePath) : filePath;
      lines.push(`  ${relPath}`);

      // Sort by line number
      const sorted = [...fileExports].sort((a, b) => a.symbol.line - b.symbol.line);
      for (const dead of sorted) {
        const lineNum = String(dead.symbol.line);
        lines.push(`    :${lineNum.padEnd(4)} ${dead.symbol.name}`);
      }
    }

    lines.push('');
  }

  // Summary
  const totalDead = deadExports.length;
  const pkgCount = sortedPackages.length;
  const deadWord = totalDead === 1 ? 'dead export' : 'dead exports';
  const pkgWord = pkgCount === 1 ? 'package' : 'packages';
  lines.push('────────────────────────────');
  lines.push(`Summary: ${totalDead} ${deadWord} across ${pkgCount} ${pkgWord}`);

  return lines.join('\n');
}

export const ReporterLive = Layer.succeed(Reporter, {
  format: formatImpl,
});
