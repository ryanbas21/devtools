---
title: '@wolfcola/treeshake-check'
description: 'CLI & library to verify packages are tree-shakeable by Rollup'
section: packages
order: 1
---

# @wolfcola/treeshake-check

Verify that your npm packages are properly tree-shakeable. Uses Rollup to bundle a synthetic consumer that imports your package entry point, then analyzes which modules survive tree-shaking and why.

## Installation

```bash
npm install -D @wolfcola/treeshake-check
```

## CLI Usage

```bash
npx treeshake-check [options]
```

By default, the CLI reads `package.json` from the current directory, resolves the entry point from the `module`, `main`, or `exports` field, and runs the analysis.

### Options

| Option    | Alias | Description                                                                     |
| --------- | ----- | ------------------------------------------------------------------------------- |
| `--cwd`   | `-C`  | Directory containing the package.json to analyze (defaults to cwd)              |
| `--entry` | `-e`  | Analyze a specific entry file directly, skipping package.json resolution        |
| `--json`  |       | Emit machine-readable JSON instead of human-readable output                     |
| `--quiet` | `-q`  | Suppress all output; rely on exit code only (exit 1 = not fully tree-shakeable) |
| `--top`   |       | Show only the N modules with the largest surviving byte count                   |

### Examples

```bash
# Check the package in the current directory
npx treeshake-check

# Check a specific directory
npx treeshake-check --cwd packages/my-lib

# Analyze a specific file
npx treeshake-check --entry dist/index.mjs

# CI gate (fails with exit code 1 if not tree-shakeable)
npx treeshake-check --quiet

# Machine-readable output
npx treeshake-check --json

# Show top 5 worst offenders
npx treeshake-check --top 5
```

## Programmatic API

### `checkPackage(cwd?)`

Full pipeline: reads `package.json` from `cwd` (defaults to `process.cwd()`), resolves the entry point, and analyzes tree-shakeability. Returns `Effect.Effect<TreeshakeResult, PackageJsonNotFound | MissingEntryPoint | BundleFailed | ParseError, FileSystem | Path>`.

```typescript
import { checkPackage } from '@wolfcola/treeshake-check';
import { Effect } from 'effect';
import { NodeContext } from '@effect/platform-node';

const result = await Effect.runPromise(
  checkPackage('./packages/my-lib').pipe(Effect.provide(NodeContext.layer)),
);
```

### `analyzeTreeshakeability(entry, pkg?)`

Analyzes a single entry file. Creates a virtual Rollup bundle that imports the entry, enables tree-shaking, and inspects what survives. Returns `Effect.Effect<TreeshakeResult, BundleFailed, Path>`.

### `getEntryFromPackageJson(cwd?)`

Reads and validates `package.json`, resolving the entry point from `module`, `main`, or `exports` fields. Returns the entry path and parsed package metadata.

## Result Types

### `TreeshakeResult`

A discriminated union (Effect `Schema.Union` of `TaggedStruct`):

- **`FullyTreeshakeable`** -- All modules rendered to zero bytes. Includes `hints` with package-level recommendations.
- **`HasSideEffects`** -- Some modules survived tree-shaking. Includes `totalOriginalBytes`, `totalRenderedBytes`, `modules` (array of per-module analysis), `warnings` (Rollup warnings), `hints`, and `unshakenCode`.

Each module in the `HasSideEffects` result includes `id`, `originalLength`, `renderedLength`, `shakingRatio`, `renderedExports`, `removedExports`, `survivingCode`, and `suspectedCauses`.

### Suspected Causes

The analyzer classifies surviving code into categories: `TopLevelSideEffect`, `PrototypeMutation`, `GlobalAssignment`, `CommonJsContamination`, `UnannotatedCall`, `EnumPattern`, `Unknown`. The CLI provides explanations and fix suggestions for each.

## Error Types

| Error                 | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `PackageJsonNotFound` | No `package.json` found at the specified path              |
| `MissingEntryPoint`   | `package.json` has no `module`, `main`, or `exports` entry |
| `BundleFailed`        | Rollup bundling failed (wraps the underlying cause)        |

<callout type="warning">This tool uses Rollup internally. Rollup is bundled as a dependency.</callout>
