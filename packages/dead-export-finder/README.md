# @wolfcola/dead-export-finder

Find unused exports across monorepo package boundaries. Scans all workspace packages, parses exports and imports with [oxc-parser](https://oxc.rs/), and reports exports that are never imported by any other package.

## Installation

```bash
npm install -D @wolfcola/dead-export-finder
```

## CLI Usage

```bash
dead-export-finder [options]
```

Run from the monorepo root. The tool auto-detects workspace packages from `pnpm-workspace.yaml` or `package.json` workspaces.

### Options

| Option              | Alias | Description                                           |
| ------------------- | ----- | ----------------------------------------------------- |
| `--packages <name>` | `-p`  | Scope analysis to specific package names (repeatable) |
| `--ignore <glob>`   | `-i`  | Glob patterns to exclude from scanning (repeatable)   |
| `--verbose`         | `-v`  | Print timing, file counts, and parse warnings         |

### Examples

```bash
# Scan all packages
dead-export-finder

# Scope to specific packages
dead-export-finder -p @wolfcola/devtools-core -p @wolfcola/devtools-types

# Ignore test files
dead-export-finder -i "**/*.test.ts" -i "**/*.spec.ts"

# Verbose output
dead-export-finder --verbose
```

Exit code is `1` when dead exports are found, `0` when clean.

## Programmatic API

All services are exported for use in custom tooling:

```typescript
import {
  WorkspaceDetector,
  WorkspaceDetectorLive,
  FileScanner,
  FileScannerLive,
  ExportParser,
  ExportParserLive,
  ImportParser,
  ImportParserLive,
  ExportGraph,
  ExportGraphLive,
  Reporter,
  ReporterLive,
} from '@wolfcola/dead-export-finder';
```

Each service follows the `Context.Service` + `Live` layer pattern from Effect.

### Types

```typescript
import type {
  PackageInfo,
  ExportedSymbol,
  ImportedSymbol,
  DeadExport,
  AnalysisResult,
  WorkspaceResult,
} from '@wolfcola/dead-export-finder';
```

### Errors

```typescript
import {
  WorkspaceNotFoundError,
  ParseError,
  EntryPointResolutionError,
} from '@wolfcola/dead-export-finder';
```

## How It Works

1. **Workspace detection** — reads `pnpm-workspace.yaml` or `package.json` workspaces to find all packages
2. **File scanning** — finds all `.ts`, `.tsx`, `.js`, `.jsx` files in each package, respecting `.gitignore` and `--ignore` globs
3. **Export parsing** — uses `oxc-parser` to extract all exported symbols from each file
4. **Import parsing** — uses `oxc-parser` to extract all imported symbols from each file
5. **Graph analysis** — builds a cross-package dependency graph and identifies exports with zero imports
6. **Reporting** — formats results grouped by package with file paths relative to package root

Parse errors are handled gracefully as warnings — the tool continues with remaining files.

## License

MIT
