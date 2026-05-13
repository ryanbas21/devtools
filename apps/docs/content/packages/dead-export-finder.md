---
title: '@wolfcola/dead-export-finder'
description: 'CLI to find unused exports across monorepo package boundaries'
section: packages
order: 5
---

# @wolfcola/dead-export-finder

A CLI tool that scans a monorepo to find exports that are never imported by any other package. Useful for identifying dead code that can be safely removed.

## Installation

```bash
npm install -D @wolfcola/dead-export-finder
```

## CLI Usage

```bash
npx dead-export-finder [options]
```

Run from the monorepo root. The tool auto-detects workspace packages from `pnpm-workspace.yaml` or `package.json` workspaces.

### Options

| Option       | Alias | Description                                         |
| ------------ | ----- | --------------------------------------------------- |
| `--packages` | `-p`  | Scope analysis to specific packages (repeatable)    |
| `--ignore`   | `-i`  | Glob patterns to exclude from scanning (repeatable) |
| `--verbose`  | `-v`  | Print timing information and parse warnings         |

### Examples

```bash
# Scan all packages in the monorepo
npx dead-export-finder

# Scope to specific packages
npx dead-export-finder -p @wolfcola/devtools-core -p @wolfcola/devtools-types

# Ignore test files
npx dead-export-finder -i "**/*.test.ts" -i "**/*.spec.ts"

# Verbose output with timing
npx dead-export-finder --verbose
```

## How It Works

1. Detects the monorepo workspace layout
2. Scans all TypeScript and JavaScript files in each package
3. Parses exported symbols from each file using `oxc-parser`
4. Parses imported symbols from each file
5. Builds an export dependency graph across package boundaries
6. Reports exports that are not imported anywhere

The tool handles parse errors gracefully, emitting warnings instead of failing. The exit code is 1 if any dead exports are found, making it suitable for CI gates.

## CI Integration

```json
{
  "scripts": {
    "check:dead-exports": "dead-export-finder"
  }
}
```

<callout type="info">This tool analyzes cross-package imports only. Exports used within the same package are not flagged.</callout>
