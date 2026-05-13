import { Schema } from 'effect';

export const WorkspaceType = Schema.Literal('pnpm', 'npm', 'yarn', 'nx', 'turborepo', 'single');

export type WorkspaceType = typeof WorkspaceType.Type;

export const PackageInfo = Schema.Struct({
  name: Schema.String,
  root: Schema.String,
  entryPoints: Schema.Array(Schema.String),
});
export type PackageInfo = Schema.Schema.Type<typeof PackageInfo>;

export const ExportedSymbol = Schema.Struct({
  name: Schema.String,
  filePath: Schema.String,
  line: Schema.Number,
  isDefault: Schema.Boolean,
  isReExport: Schema.Boolean,
  reExportSource: Schema.optional(Schema.String),
  reExportLocalName: Schema.optional(Schema.String),
});
export type ExportedSymbol = Schema.Schema.Type<typeof ExportedSymbol>;

export const ImportedSymbol = Schema.Struct({
  name: Schema.String,
  filePath: Schema.String,
  source: Schema.String,
  isNamespace: Schema.Boolean,
  isDynamic: Schema.Boolean,
});
export type ImportedSymbol = Schema.Schema.Type<typeof ImportedSymbol>;

export const DeadExport = Schema.Struct({
  symbol: ExportedSymbol,
  packageName: Schema.String,
});
export type DeadExport = Schema.Schema.Type<typeof DeadExport>;

export const AnalysisResult = Schema.Struct({
  deadExports: Schema.Array(DeadExport),
  totalExports: Schema.Number,
  totalFiles: Schema.Number,
  warnings: Schema.Array(Schema.String),
});
export type AnalysisResult = Schema.Schema.Type<typeof AnalysisResult>;
