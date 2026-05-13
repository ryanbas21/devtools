import { it } from '@effect/vitest';
import { expect } from 'vitest';
import { Effect } from 'effect';
import { Reporter, ReporterLive } from './reporter.js';
import type { AnalysisResult, DeadExport } from './schemas.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeDeadExport = (
  name: string,
  filePath: string,
  line: number,
  packageName: string,
): DeadExport =>
  ({
    symbol: { name, filePath, line, isDefault: false, isReExport: false },
    packageName,
  }) as unknown as DeadExport;

const makeResult = (deadExports: DeadExport[], totalExports = 10, totalFiles = 5): AnalysisResult =>
  ({
    deadExports,
    totalExports,
    totalFiles,
    warnings: [],
  }) as unknown as AnalysisResult;

// ─── tests ────────────────────────────────────────────────────────────────────

it.effect('formats dead exports grouped by package and file', () =>
  Effect.gen(function* () {
    const reporter = yield* Reporter;

    const deadExports: DeadExport[] = [
      makeDeadExport('slugify', '/repo/packages/utils/src/string.ts', 12, '@myorg/utils'),
      makeDeadExport('camelToKebab', '/repo/packages/utils/src/string.ts', 45, '@myorg/utils'),
      makeDeadExport(
        'useDebounce',
        '/repo/packages/shared/src/hooks/useDebounce.ts',
        3,
        '@myorg/shared',
      ),
    ];

    const result = makeResult(deadExports);

    const packageRoots = new Map<string, string>([
      ['@myorg/utils', '/repo/packages/utils'],
      ['@myorg/shared', '/repo/packages/shared'],
    ]);

    const output = reporter.format(result, packageRoots);

    // Header
    expect(output).toContain('Dead Export Report');

    // Package grouping with counts
    expect(output).toContain('@myorg/utils (2 dead exports)');
    expect(output).toContain('@myorg/shared (1 dead export)');

    // Relative file paths
    expect(output).toContain('src/string.ts');
    expect(output).toContain('src/hooks/useDebounce.ts');

    // Line numbers and export names
    expect(output).toContain(':12');
    expect(output).toContain('slugify');
    expect(output).toContain(':45');
    expect(output).toContain('camelToKebab');
    expect(output).toContain(':3');
    expect(output).toContain('useDebounce');

    // Summary line
    expect(output).toContain('Summary: 3 dead exports across 2 packages');
  }).pipe(Effect.provide(ReporterLive)),
);

it.effect('returns clean message when no dead exports found', () =>
  Effect.gen(function* () {
    const reporter = yield* Reporter;

    const result = makeResult([], 42, 8);
    const packageRoots = new Map<string, string>();

    const output = reporter.format(result, packageRoots);

    expect(output).toContain('No dead exports found');
    expect(output).toContain('42');
    expect(output).toContain('8');
  }).pipe(Effect.provide(ReporterLive)),
);
