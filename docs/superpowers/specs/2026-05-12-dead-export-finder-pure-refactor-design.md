# Dead Export Finder — Pure Functional Refactor

## Goal

Eliminate all mutation from the `dead-export-finder` package internals. Use pipe syntax with small, well-named composed functions. Leverage Effect's `HashSet`/`HashMap` internally where structural equality matters, keep native `ReadonlyMap`/`ReadonlyArray` at service boundaries.

## Constraints

- Service topology unchanged (WorkspaceDetector, FileScanner, ExportParser, ImportParser, ExportGraph, Reporter)
- All existing tests pass without modification (Map is assignable to ReadonlyMap)
- Effect boundary stays at parse/IO level — pure synchronous functions inside

## Service Interface Changes

- `ExportGraph.analyze`: parameters become `ReadonlyMap` instead of `Map`
- `Reporter.format`: `packageRoots` becomes `ReadonlyMap<string, string>`
- No new services added, none removed

## File-by-File Plan

### export-parser.ts

- Replace `symbols.push()` in switch/case with `Array.flatMap(extractExportsFromNode)` over `program.body`
- Small pure extractors: `extractNamedDeclaration`, `extractDefaultDeclaration`, `extractAllDeclaration`, `extractCjsExports` — each returns `ReadonlyArray<ExportedSymbol>`
- `extractDeclarationNames` returns `ReadonlyArray<string>`
- `lineFromOffset` stays as pure function (already is), replace mutable counter
- `Effect.try` boundary stays for `oxc.parseSync`

### import-parser.ts

- `walkNode(node, filePath, symbols)` → `collectSymbols(node, filePath): ReadonlyArray<ImportedSymbol>` — pure recursive, returns results
- Children via `Array.flatMap` recurse
- Static imports: `Array.flatMap(extractStaticImports)` over ImportDeclaration nodes
- Concatenate with `collectSymbols` results
- Same `Effect.try` boundary

### export-graph.ts

- `resolveEntryPoints(packages, scannedFiles) → HashSet<string>`
- `buildFileToPackageMap(packages, exportedFilePaths) → ReadonlyMap<string, PackageInfo>`
- `buildConsumedSets(allImports, allExports) → { byRelative: HashSet, byPackage: HashSet, byNamespace: HashSet }`
  - `collectImportEdges` + `collectReExportEdges` merged with `HashSet.union`
- `findDeadExports(...)` — pure filter with `Array.filter(isNotConsumed)`
- `analyze` becomes ~15 lines piping through steps 1–4

### reporter.ts

- `Array.groupBy` for package/file grouping
- `formatPackageSection` returns `ReadonlyArray<string>`
- Top-level: header → sections → summary, `Array.join("\n")`

### file-scanner.ts

- `loadGitignorePatterns(root)` → `Effect<ReadonlyArray<string>>`
- `buildIgnorePatterns(gitignore, custom)` — pure concatenation
- Single `ignore()` construction from full pattern list

### workspace-detector.ts

- Nested if/else → `pipe(detectPnpm, Effect.orElse(detectNpm), Effect.orElse(detectNx), Effect.orElse(detectTurbo), Effect.orElse(detectSingle))`
- Each detector is a small function returning `Effect<WorkspaceResult, WorkspaceNotFoundError>`

### index.ts (CLI)

- `scanWorkspace(workspace, ignoreGlobs, verbose)` → immutable file map + warnings
- `parseAllFiles(filesByPackage, verbose)` → immutable exports/imports maps + warnings
- `analyzeAndReport(...)` → calls graph + reporter
- Command handler becomes ~20 lines
- Warnings concatenated at end with `Array.appendAll`

## Testing

Zero test file changes. All `Map` constructions in tests are assignable to `ReadonlyMap`. All assertions remain valid.
