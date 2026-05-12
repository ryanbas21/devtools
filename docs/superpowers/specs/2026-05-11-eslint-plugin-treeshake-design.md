# ESLint Plugin: `@wolfcola/eslint-plugin-treeshake`

**Date:** 2026-05-11
**Status:** Draft
**Package:** `packages/eslint-plugin-treeshake`

## Purpose

An ESLint plugin that flags code patterns known to break tree-shaking, with an opt-in mode that runs the full Rollup-based `@wolfcola/treeshake-check` analysis and maps results back to source locations as ESLint diagnostics.

## Rule: `wolfcola/no-treeshake-hazard`

A single rule covering all hazard categories, with per-category toggles.

### Options

```ts
interface RuleOptions {
  /** Flag TypeScript enums (compile to IIFEs). Default: true */
  checkEnums: boolean;
  /** Flag top-level calls without \/*#__PURE__*\/ annotation. Default: true */
  checkUnannotatedCalls: boolean;
  /** Flag Object.defineProperty, .prototype mutation at module scope. Default: true */
  checkPrototypeMutation: boolean;
  /** Flag assignments to window/globalThis/self/global. Default: true */
  checkGlobalAssignment: boolean;
  /** Flag require()/module.exports/__esModule in ESM files. Default: true */
  checkCjsPatterns: boolean;
  /** Function names/paths that are known pure (skip unannotated-call check). Default: [] */
  additionalPureFunctions: string[];
  /** Run the full Rollup-based treeshake-check and report results as ESLint errors. Default: false */
  bundleCheck: boolean;
  /** Working directory for bundleCheck. Defaults to the directory containing the nearest package.json. */
  bundleCheckCwd: string | undefined;
}
```

All boolean checks default to `true` except `bundleCheck` which defaults to `false`.

### Static checks (fast, per-file)

These run as standard ESLint AST visitors. They only inspect top-level (module scope) nodes.

| Hazard              | AST target                                                      | Detection                                                                                                                         |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `EnumPattern`       | `TSEnumDeclaration`                                             | Any TS enum declaration                                                                                                           |
| `UnannotatedCall`   | `ExpressionStatement > CallExpression`                          | Top-level call not preceded by `/*#__PURE__*/` comment and not in the known-pure allowlist                                        |
| `PrototypeMutation` | `MemberExpression` + `AssignmentExpression` or `CallExpression` | `Object.defineProperty(...)`, `Object.defineProperties(...)`, `Object.setPrototypeOf(...)`, `X.prototype.y = ...` at module scope |
| `GlobalAssignment`  | `AssignmentExpression`                                          | `window.x = ...`, `globalThis.x = ...`, `self.x = ...`, `global.x = ...` at module scope                                          |
| `CjsPatterns`       | `CallExpression`, `MemberExpression`                            | `require(...)`, `module.exports`, `exports.x`, `__esModule` references in `.ts`/`.mts`/`.mjs` files                               |

#### Scope detection

"Module scope" means the node is a direct child of `Program.body`. We do NOT flag these patterns inside functions, classes, or other nested scopes — those only execute when called, so bundlers can eliminate them.

#### Known-pure allowlist

These top-level calls are not flagged by `checkUnannotatedCalls`:

```ts
const KNOWN_PURE_CALLS = new Set([
  'Object.freeze',
  'Object.create',
  'Object.keys',
  'Object.values',
  'Object.entries',
  'Object.fromEntries',
  'Symbol',
  'Symbol.for',
  'Array.from',
  'Array.of',
  'Array.isArray',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Number.isNaN',
  'Number.isFinite',
  'Number.parseInt',
  'Number.parseFloat',
  'String.fromCharCode',
  'String.fromCodePoint',
  'JSON.parse',
  'JSON.stringify',
  'Math.max',
  'Math.min',
  'Math.floor',
  'Math.ceil',
  'Math.round',
  'Math.abs',
  'Promise.resolve',
  'Promise.reject',
]);
```

Users extend this with `additionalPureFunctions`.

#### Autofix and suggestions

| Hazard            | Fix type            | What it does                                         |
| ----------------- | ------------------- | ---------------------------------------------------- |
| `UnannotatedCall` | Autofix (`--fix`)   | Inserts `/*#__PURE__*/ ` before the call expression  |
| `EnumPattern`     | Suggestion (manual) | Shows the `as const` object + type alias alternative |
| All others        | None                | Message includes actionable guidance                 |

The `/*#__PURE__*/` autofix is safe because it's a bundler hint with no runtime effect. The enum suggestion changes semantics (enums are values + types) so it requires manual acceptance.

#### Error messages

Each diagnostic includes:

- **What**: one-line summary of the hazard (from `EXPLANATIONS`-equivalent data)
- **Why**: why it breaks tree-shaking
- **Fix**: concrete steps

Example:

```
Top-level function call without /*#__PURE__*/ annotation.
Bundlers treat bare function calls at module scope as side-effectful.
Add /*#__PURE__*/ before the call if you know it has no side effects.
```

### Bundle check (opt-in, slow)

When `bundleCheck: true`, the rule runs `@wolfcola/treeshake-check`'s Rollup analysis at lint time.

#### Execution

- Runs once per lint invocation (not per-file). The rule caches the result and distributes diagnostics to the relevant files as ESLint processes them.
- Uses a module-level singleton: on the first file visit, trigger the analysis. Store results keyed by absolute file path. On subsequent file visits, look up and report.
- The analysis resolves the entry point from the nearest `package.json` (or `bundleCheckCwd` if specified).

#### Mapping results to source locations

1. `ModuleAnalysis.id` gives the absolute file path of the offending module.
2. For each offending module, attempt **snippet matching**: search the source file for the `survivingCode` fragment. If found, report at the matched line/column.
3. If snippet matching fails (transformed output doesn't match source), fall back to **file-level diagnostic** on line 1 with the full explanation.

#### Deduplication with static checks

When both static and bundle checks produce findings for the same file:

- Dedup key: `(filePath, causeCategory)` where `causeCategory` is one of `EnumPattern | UnannotatedCall | PrototypeMutation | GlobalAssignment | CommonJsContamination | TopLevelSideEffect | Unknown`.
- If a static check already reported a cause category for a file, the bundle check skips that category for that file.
- Bundle check findings with cause categories the static pass didn't catch are reported as additional diagnostics.

#### Performance warning

When `bundleCheck` is enabled, the plugin logs a one-time info message:

```
[wolfcola/no-treeshake-hazard] Bundle check enabled. This runs a full Rollup build and may be slow on large projects. Consider running only in CI or with --cache.
```

## Package structure

```
packages/eslint-plugin-treeshake/
  package.json
  tsconfig.json
  tsconfig.lib.json
  eslint.config.mjs
  vitest.config.mts
  src/
    index.ts                    # Plugin entry: exports { rules, configs }
    lib/
      no-treeshake-hazard.ts    # The rule implementation
      known-pure.ts             # KNOWN_PURE_CALLS set
      explanations.ts           # Cause explanations (standalone copy)
      scope-utils.ts            # Helper: is this node at module scope?
      bundle-check.ts           # Bundle-check integration (imports treeshake-check)
      snippet-match.ts          # Map surviving code back to source locations
    lib/
      no-treeshake-hazard.test.ts
      known-pure.test.ts
      bundle-check.test.ts
      snippet-match.test.ts
```

### Dependencies

```json
{
  "dependencies": {},
  "peerDependencies": {
    "eslint": ">=9.0.0"
  },
  "optionalDependencies": {
    "@wolfcola/treeshake-check": "workspace:*"
  }
}
```

`@wolfcola/treeshake-check` is an **optional dependency**. The static checks work without it. If `bundleCheck: true` is set and the package isn't installed, the rule throws a clear error: `"bundleCheck requires @wolfcola/treeshake-check to be installed"`.

### Exported configs

```ts
// Recommended: all static checks on, bundleCheck off
export const configs = {
  recommended: {
    plugins: { wolfcola: plugin },
    rules: {
      'wolfcola/no-treeshake-hazard': 'warn',
    },
  },
  strict: {
    plugins: { wolfcola: plugin },
    rules: {
      'wolfcola/no-treeshake-hazard': ['error', { bundleCheck: true }],
    },
  },
};
```

## Testing strategy

### Static checks

Use ESLint's `RuleTester` with `@typescript-eslint/parser`. Test cases:

- Each hazard category: valid code (not flagged) and invalid code (flagged with correct message)
- Known-pure calls not flagged
- `additionalPureFunctions` respected
- Nested scope (inside function/class) not flagged
- `/*#__PURE__*/` annotation suppresses the check
- Autofix for unannotated calls inserts annotation correctly
- Enum suggestion produces correct `as const` output
- Per-category disable via options

### Bundle check

- Integration test with a small fixture package that has known side effects
- Verify diagnostics map to correct files
- Verify dedup: static + bundle findings for same file/cause produce one diagnostic
- Verify graceful error when `@wolfcola/treeshake-check` is not installed
- Verify snippet matching finds correct line numbers
- Verify file-level fallback when snippet matching fails

## Scope boundaries

### In scope

- Single ESLint rule with sub-options
- Static AST checks for 5 hazard categories
- Known-pure allowlist with user extension
- Autofix for `/*#__PURE__*/`, suggestion for enum replacement
- Opt-in bundle check via `@wolfcola/treeshake-check`
- Dedup between static and bundle findings
- `recommended` and `strict` preset configs
- create readme, document everything, setup provenance (see other package.jsons to understand how to do it)
- Checking `package.json` for `sideEffects` field
- Auto-detecting the package manager or monorepo structure

### Out of scope

- Cross-file analysis (which imports pull in side-effectful modules)
- Custom Rollup/esbuild/webpack plugin integration
