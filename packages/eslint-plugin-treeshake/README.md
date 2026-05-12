# @wolfcola/eslint-plugin-treeshake

An ESLint plugin that flags code patterns known to break tree-shaking. Catches problems at authoring time so they don't reach production bundles.

Optionally integrates with [@wolfcola/treeshake-check](https://www.npmjs.com/package/@wolfcola/treeshake-check) for full Rollup-based bundle analysis mapped back to source locations.

## Installation

```bash
pnpm add -D @wolfcola/eslint-plugin-treeshake
```

For bundle-check mode (optional):

```bash
pnpm add -D @wolfcola/treeshake-check
```

## Setup

### Flat config (ESLint 9+)

```js
// eslint.config.mjs
import treeshake from '@wolfcola/eslint-plugin-treeshake';

export default [
  // Use the recommended preset (all static checks, warn severity)
  treeshake.configs.recommended,

  // Or configure manually:
  {
    plugins: { wolfcola: treeshake },
    rules: {
      'wolfcola/no-treeshake-hazard': [
        'warn',
        {
          checkEnums: true,
          checkUnannotatedCalls: true,
          checkPrototypeMutation: true,
          checkGlobalAssignment: true,
          checkCjsPatterns: true,
          checkSideEffectsField: true,
          additionalPureFunctions: [],
          bundleCheck: false,
        },
      ],
    },
  },
];
```

### Strict preset

Enables all static checks at `error` severity and turns on bundle-check mode:

```js
import treeshake from '@wolfcola/eslint-plugin-treeshake';

export default [treeshake.configs.strict];
```

## Rule: `wolfcola/no-treeshake-hazard`

A single rule covering all tree-shaking hazard categories.

### What it detects

| Hazard                    | What it flags                                                 | Autofix                       |
| ------------------------- | ------------------------------------------------------------- | ----------------------------- |
| `EnumPattern`             | TypeScript `enum` declarations at module scope                | Suggestion: `as const` object |
| `UnannotatedCall`         | Top-level function calls without `/*#__PURE__*/`              | Fix: inserts `/*#__PURE__*/`  |
| `PrototypeMutation`       | `Object.defineProperty`, `.prototype.x = ...` at module scope | None                          |
| `GlobalAssignment`        | `window.x = ...`, `globalThis.x = ...` at module scope        | None                          |
| `CjsPatterns`             | `require()`, `module.exports` in ESM files                    | None                          |
| `MissingSideEffectsField` | Missing `"sideEffects"` field in the nearest `package.json`   | None                          |

### Options

| Option                    | Type       | Default | Description                                      |
| ------------------------- | ---------- | ------- | ------------------------------------------------ |
| `checkEnums`              | `boolean`  | `true`  | Flag TypeScript enums                            |
| `checkUnannotatedCalls`   | `boolean`  | `true`  | Flag top-level calls without `/*#__PURE__*/`     |
| `checkPrototypeMutation`  | `boolean`  | `true`  | Flag prototype/property mutations                |
| `checkGlobalAssignment`   | `boolean`  | `true`  | Flag global object assignments                   |
| `checkCjsPatterns`        | `boolean`  | `true`  | Flag CommonJS patterns in ESM                    |
| `checkSideEffectsField`   | `boolean`  | `true`  | Warn if nearest package.json lacks `sideEffects` |
| `additionalPureFunctions` | `string[]` | `[]`    | Function names to treat as side-effect-free      |
| `bundleCheck`             | `boolean`  | `false` | Run full Rollup-based analysis (slow)            |
| `bundleCheckCwd`          | `string`   | auto    | Working directory for bundle check               |

### Known-pure functions (not flagged)

The following top-level calls are recognized as side-effect-free and not flagged by `checkUnannotatedCalls`:

`Object.freeze`, `Object.create`, `Object.keys`, `Object.values`, `Object.entries`, `Object.fromEntries`, `Symbol`, `Symbol.for`, `Array.from`, `Array.of`, `Array.isArray`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Number.isNaN`, `Number.isFinite`, `Number.parseInt`, `Number.parseFloat`, `String.fromCharCode`, `String.fromCodePoint`, `JSON.parse`, `JSON.stringify`, `Math.max`, `Math.min`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.abs`, `Promise.resolve`, `Promise.reject`

Extend with `additionalPureFunctions`.

### Bundle check mode

When `bundleCheck: true`, the rule runs a full Rollup build via `@wolfcola/treeshake-check` and maps results back to source locations. This is slow but catches issues that static analysis misses (transitive side effects, bundler-specific behavior).

Bundle-check findings are deduplicated against static findings — if both detect the same hazard category in the same file, only the static finding is reported.

Requires `@wolfcola/treeshake-check` as a dev dependency.

### Relationship to @wolfcola/treeshake-check

|                 | eslint-plugin-treeshake          | treeshake-check          |
| --------------- | -------------------------------- | ------------------------ |
| **When**        | Authoring time                   | Post-build / CI          |
| **Speed**       | Fast (per-file AST)              | Slow (full Rollup build) |
| **Accuracy**    | Heuristic                        | Ground truth             |
| **Integration** | Editor squiggles, `eslint --fix` | CLI, exit codes          |

Use both: the ESLint plugin for fast feedback during development, `treeshake-check` as a CI quality gate.

## Examples

### Before (flagged)

```ts
// Enum - breaks tree-shaking
export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// Unannotated call - bundler assumes side effects
const registry = createRegistry();

// Global assignment - observable side effect
window.MY_APP = { version: '1.0' };
```

### After (clean)

```ts
// as const object - fully shakeable
export const Direction = {
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

// PURE annotation - bundler can safely drop if unused
const registry = /*#__PURE__*/ createRegistry();

// Moved into an explicit init function
export function initApp() {
  window.MY_APP = { version: '1.0' };
}
```
