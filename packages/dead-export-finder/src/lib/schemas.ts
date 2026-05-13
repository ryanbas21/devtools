import { Schema } from 'effect';

export const WorkspaceType = Schema.Literal('pnpm', 'npm', 'yarn', 'nx', 'turborepo', 'single');

export type WorkspaceType = typeof WorkspaceType.Type;

export class PackageInfo extends Schema.Class<PackageInfo>('PackageInfo')({
  name: Schema.String,
  root: Schema.String,
  entryPoints: Schema.Array(Schema.String),
}) {}

export class ExportedSymbol extends Schema.Class<ExportedSymbol>('ExportedSymbol')({
  name: Schema.String,
  filePath: Schema.String,
  line: Schema.Number,
  isDefault: Schema.Boolean,
  isReExport: Schema.Boolean,
  reExportSource: Schema.optional(Schema.String),
}) {}

export class ImportedSymbol extends Schema.Class<ImportedSymbol>('ImportedSymbol')({
  name: Schema.String,
  filePath: Schema.String,
  source: Schema.String,
  isNamespace: Schema.Boolean,
  isDynamic: Schema.Boolean,
}) {}

export class DeadExport extends Schema.Class<DeadExport>('DeadExport')({
  symbol: ExportedSymbol,
  packageName: Schema.String,
}) {}

export class AnalysisResult extends Schema.Class<AnalysisResult>('AnalysisResult')({
  deadExports: Schema.Array(DeadExport),
  totalExports: Schema.Number,
  totalFiles: Schema.Number,
  warnings: Schema.Array(Schema.String),
}) {}
