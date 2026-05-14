// Public API
export { WorkspaceDetector, WorkspaceDetectorLive } from './lib/workspace-detector.js';
export type { WorkspaceResult } from './lib/workspace-detector.js';
export { FileScanner, FileScannerLive } from './lib/file-scanner.js';
export { ExportParser, ExportParserLive } from './lib/export-parser.js';
export { ImportParser, ImportParserLive } from './lib/import-parser.js';
export { ExportGraph, ExportGraphLive } from './lib/export-graph.js';
export { Reporter, ReporterLive } from './lib/reporter.js';
export { WorkspaceNotFoundError, ParseError, EntryPointResolutionError } from './lib/errors.js';
export type {
  PackageInfo,
  ExportedSymbol,
  ImportedSymbol,
  DeadExport,
  AnalysisResult,
} from './lib/schemas.js';
