# @wolfcola/treeshake-check

A tree-shakeability analyzer for npm packages. Tells you whether your package can be fully tree-shaken by Rollup, and when it can't, points at the specific files, exports, and likely causes preventing it.

Built on [Effect](https://effect.website), [@effect/cli](https://www.npmjs.com/package/@effect/cli), and [Rollup](https://rollupjs.org).

## Why this exists

When you publish a library, consumers' bundlers (webpack, Rollup, Vite, esbuild) try to eliminate unused exports from your package — that's tree-shaking. If your package isn't shakeable, every consumer who imports a single function pulls in your entire library, inflating their bundle size.

Tree-shakeability isn't visible from the outside. You can ship what looks like a clean ESM library and still have it be unshakeable due to a single `Object.defineProperty` call at module scope, a missing `"sideEffects": false` in `package.json`, or a transitive CJS dependency. This tool surfaces those problems.

The technique is the same one used by Rich Harris's [agadoo](https://www.npmjs.com/package/agadoo): bundle your package as a side-effect-only import (`import "your-package"` with no bindings used) and see what Rollup couldn't eliminate. Anything that survives is what's preventing tree-shaking.

## Installation

```bash
pnpm add -D @wolfcola/treeshake-check
```

## Usage

### Quickstart

From any package directory:

```bash
pnpm treeshake-check
```

You'll get one of two outcomes:

- **Fully tree-shakeable** — ASCII tree celebration plus any recommendations for `package.json` improvements.
- **Has side effects** — a per-module breakdown of what survived, with diagnostic info for each file.

### Flags

| Flag             | Alias | Description                                                                     |
| ---------------- | ----- | ------------------------------------------------------------------------------- |
| `--cwd <path>`   | `-C`  | Directory containing `package.json`. Defaults to the current working directory. |
| `--entry <path>` | `-e`  | Analyze a specific entry file directly, skipping `package.json` resolution.     |
| `--json`         |       | Emit machine-readable JSON instead of human output.                             |
| `--quiet`        | `-q`  | Suppress all output; rely on the exit code only.                                |
| `--top <n>`      |       | Show only the N modules with the largest surviving byte count.                  |

Plus the standard `--help`, `--version`, `--wizard`, and `--completions <shell>` flags from `@effect/cli`.

### Examples

Check the current package:

```bash
pnpm treeshake-check
```

Check a different package in the workspace:

```bash
pnpm treeshake-check --cwd packages/my-sdk
```

Check a specific built file directly:

```bash
pnpm treeshake-check --entry dist/index.js
```

Show only the worst 5 offenders:

```bash
pnpm treeshake-check --top 5
```

JSON output for CI tooling:

```bash
pnpm treeshake-check --json | jq '.modules[] | {id, renderedLength, suspectedCauses}'
```

## Detected causes

The analyzer uses AST-based heuristics to classify surviving code:

| Cause                   | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `EnumPattern`           | TypeScript enum compiled to IIFE                          |
| `CommonJsContamination` | `require()`, `module.exports`, `__esModule` markers       |
| `PrototypeMutation`     | `Object.defineProperty`, `.prototype.x = ...`             |
| `GlobalAssignment`      | Assignment to `window`, `globalThis`, `self`, or `global` |
| `UnannotatedCall`       | Top-level function call without `/*#__PURE__*/`           |
| `TopLevelSideEffect`    | Top-level statement with observable effects               |
| `Unknown`               | None of the above patterns matched                        |

Labels are heuristic — a starting point for investigation, not a verdict.

## Programmatic usage

```typescript
import { Effect } from 'effect';
import { NodeContext } from '@effect/platform-node';
import { checkPackage } from '@wolfcola/treeshake-check';

const program = Effect.gen(function* () {
  const result = yield* checkPackage('./packages/sdk');

  if (result._tag === 'FullyTreeshakeable') {
    return true;
  }

  for (const m of result.modules) {
    console.log(`${m.id}: ${m.renderedLength}/${m.originalLength} bytes`);
    console.log(`  causes: ${m.suspectedCauses.join(', ')}`);
  }
  return false;
});

const isShakeable = await Effect.runPromise(program.pipe(Effect.provide(NodeContext.layer)));
```

## CI integration

`treeshake-check` exits with code 1 when a package isn't fully shakeable, so it composes naturally as a quality gate.

### GitHub Actions

```yaml
- name: Tree-shake check
  run: pnpm -r --filter "./packages/*" exec treeshake-check --top 5
```

### As a pre-publish hook

```json
{
  "scripts": {
    "prepublishOnly": "treeshake-check --quiet"
  }
}
```

### Across a monorepo

```bash
pnpm -r --parallel exec treeshake-check --top 3
```

## How it works

1. Reads `package.json` from the target directory and resolves the entry point (`exports` → `module` → `main`).
2. Constructs a synthetic Rollup entry that imports the target as a side-effect-only import: `import "/absolute/path/to/entry.js"`.
3. Runs Rollup with default tree-shaking enabled.
4. Inspects `chunk.modules` for per-module `renderedLength`, `renderedExports`, and `removedExports`.
5. Classifies surviving code by AST analysis (with regex fallback for unparseable output).
6. Reports per-module statistics, surviving code, and `package.json` recommendations.

## Prior art

- [agadoo](https://www.npmjs.com/package/agadoo) by Rich Harris — same technique, the original implementation. This package adds richer diagnostics, structured output, and Effect-based composition.
- [bundlephobia](https://bundlephobia.com) — measures the post-shake size from a consumer's perspective rather than analyzing why shaking succeeds or fails.
