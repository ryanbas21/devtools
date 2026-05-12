import type { HazardCategory } from './explanations.js';
import { findSnippetLocation } from './snippet-match.js';

export interface BundleFileReport {
  readonly filePath: string;
  readonly causes: ReadonlyArray<HazardCategory>;
  readonly survivingCode: string | null;
  readonly line: number;
  readonly column: number;
}

const mapCause = (cause: string): HazardCategory => {
  switch (cause) {
    case 'EnumPattern':
      return 'EnumPattern';
    case 'CommonJsContamination':
      return 'CjsPatterns';
    case 'PrototypeMutation':
      return 'PrototypeMutation';
    case 'GlobalAssignment':
      return 'GlobalAssignment';
    case 'UnannotatedCall':
      return 'UnannotatedCall';
    case 'TopLevelSideEffect':
      return 'TopLevelSideEffect';
    default:
      return 'Unknown';
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadTreeshakeCheck = async (): Promise<any> => {
  // Use a variable to prevent TypeScript from resolving the optional dep at compile time
  const pkg = '@wolfcola/treeshake-check';
  try {
    return await import(pkg);
  } catch {
    throw new Error(
      'bundleCheck requires @wolfcola/treeshake-check to be installed. ' +
        'Run: pnpm add -D @wolfcola/treeshake-check',
    );
  }
};

export const mapResultToFileReports = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
  sourceContents?: Map<string, string>,
): BundleFileReport[] => {
  if (result._tag === 'FullyTreeshakeable') return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.modules.map((mod: any): BundleFileReport => {
    const causes = (mod.suspectedCauses as string[]).map(mapCause);

    let line = 1;
    let column = 0;
    if (mod.survivingCode && sourceContents?.has(mod.id)) {
      const loc = findSnippetLocation(sourceContents.get(mod.id)!, mod.survivingCode);
      if (loc) {
        line = loc.line;
        column = loc.column;
      }
    }

    return {
      filePath: mod.id,
      causes,
      survivingCode: mod.survivingCode ?? null,
      line,
      column,
    };
  });
};

export const deduplicateReports = (
  bundleReports: BundleFileReport[],
  staticFindings: Map<string, Set<HazardCategory>>,
): BundleFileReport[] =>
  bundleReports
    .map((report) => {
      const staticCauses = staticFindings.get(report.filePath);
      if (!staticCauses) return report;

      const remaining = report.causes.filter((c) => !staticCauses.has(c));
      if (remaining.length === 0) return null;

      return { ...report, causes: remaining };
    })
    .filter((r): r is BundleFileReport => r !== null);
