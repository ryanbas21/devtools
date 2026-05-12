import { describe, it, expect } from 'vitest';
import { mapResultToFileReports, deduplicateReports } from './bundle-check.js';
import type { HazardCategory } from './explanations.js';

describe('mapResultToFileReports', () => {
  it('maps a HasSideEffects result to file-level reports', () => {
    const result = {
      _tag: 'HasSideEffects' as const,
      totalOriginalBytes: 1000,
      totalRenderedBytes: 500,
      modules: [
        {
          id: '/src/foo.ts',
          originalLength: 500,
          renderedLength: 250,
          shakingRatio: 0.5,
          renderedExports: ['foo'],
          removedExports: ['bar'],
          survivingCode: 'Object.defineProperty(exports, "__esModule", { value: true });',
          suspectedCauses: ['CommonJsContamination'],
        },
      ],
      warnings: [],
      hints: {
        hasSideEffectsField: false,
        hasModuleField: true,
        hasTypeModule: true,
        recommendations: [],
      },
      unshakenCode: '',
    };

    const reports = mapResultToFileReports(result);
    expect(reports).toHaveLength(1);
    expect(reports[0].filePath).toBe('/src/foo.ts');
    expect(reports[0].causes).toContain('CjsPatterns');
  });

  it('returns empty array for FullyTreeshakeable result', () => {
    const result = {
      _tag: 'FullyTreeshakeable' as const,
      hints: {
        hasSideEffectsField: true,
        hasModuleField: true,
        hasTypeModule: true,
        recommendations: [],
      },
    };
    const reports = mapResultToFileReports(result);
    expect(reports).toHaveLength(0);
  });
});

describe('deduplicateReports', () => {
  it('removes bundle findings already covered by static checks', () => {
    const staticFindings = new Map<string, Set<HazardCategory>>([
      ['/src/foo.ts', new Set(['EnumPattern'])],
    ]);
    const bundleReports = [
      {
        filePath: '/src/foo.ts',
        causes: ['EnumPattern' as HazardCategory],
        survivingCode: 'enum code',
        line: 1,
        column: 0,
      },
      {
        filePath: '/src/foo.ts',
        causes: ['CjsPatterns' as HazardCategory],
        survivingCode: 'require code',
        line: 5,
        column: 0,
      },
      {
        filePath: '/src/bar.ts',
        causes: ['GlobalAssignment' as HazardCategory],
        survivingCode: 'window.x',
        line: 1,
        column: 0,
      },
    ];

    const result = deduplicateReports(bundleReports, staticFindings);
    expect(result).toHaveLength(2);
    expect(result[0].filePath).toBe('/src/foo.ts');
    expect(result[0].causes).toEqual(['CjsPatterns']);
    expect(result[1].filePath).toBe('/src/bar.ts');
  });

  it('keeps all reports when no static findings exist', () => {
    const staticFindings = new Map<string, Set<HazardCategory>>();
    const bundleReports = [
      {
        filePath: '/src/foo.ts',
        causes: ['EnumPattern' as HazardCategory],
        survivingCode: 'code',
        line: 1,
        column: 0,
      },
    ];
    const result = deduplicateReports(bundleReports, staticFindings);
    expect(result).toHaveLength(1);
  });
});
