---
title: '@wolfcola/eslint-plugin-treeshake'
description: 'ESLint plugin that flags tree-shaking hazards in your code'
section: packages
order: 2
---

# @wolfcola/eslint-plugin-treeshake

An ESLint plugin that statically analyzes your source code for patterns known to break tree-shaking in JavaScript bundlers.

## Installation

```bash
npm install -D @wolfcola/eslint-plugin-treeshake
```

## Configuration

### Flat Config (recommended)

```javascript
import treeshake from '@wolfcola/eslint-plugin-treeshake';

// Warns on all hazard patterns
export default [treeshake.configs.recommended];
```

### Strict Config

```javascript
import treeshake from '@wolfcola/eslint-plugin-treeshake';

// Errors on all hazard patterns + enables bundle check
export default [treeshake.configs.strict];
```

The `strict` config sets the rule to `error` level and enables `bundleCheck: true`, which runs `treeshake-check --json` as part of linting to cross-reference static findings with actual bundle analysis.

## Rule: `no-treeshake-hazard`

A single rule that detects multiple categories of tree-shaking hazards. Each category can be individually toggled.

### Detected Patterns

| Pattern               | Option                   | Default | Description                                                             |
| --------------------- | ------------------------ | ------- | ----------------------------------------------------------------------- |
| Enum declarations     | `checkEnums`             | `true`  | TypeScript `enum` compiles to an IIFE that bundlers cannot remove       |
| Unannotated calls     | `checkUnannotatedCalls`  | `true`  | Top-level function calls without `/*#__PURE__*/` annotation             |
| Prototype mutations   | `checkPrototypeMutation` | `true`  | `Object.defineProperty`, `Object.setPrototypeOf`, `X.prototype.y = ...` |
| Global assignments    | `checkGlobalAssignment`  | `true`  | Assignments to `window`, `globalThis`, `self`, `global`                 |
| CommonJS patterns     | `checkCjsPatterns`       | `true`  | `require()`, `module.exports`, `exports.x`                              |
| Missing `sideEffects` | `checkSideEffectsField`  | `true`  | Warns when nearest `package.json` lacks a `sideEffects` field           |
| Bundle check (opt-in) | `bundleCheck`            | `false` | Runs `treeshake-check --json` and maps results to source locations      |

### Rule Options

```javascript
'wolfcola/no-treeshake-hazard': ['warn', {
  checkEnums: true,
  checkUnannotatedCalls: true,
  checkPrototypeMutation: true,
  checkGlobalAssignment: true,
  checkCjsPatterns: true,
  checkSideEffectsField: true,
  additionalPureFunctions: ['myPureHelper'],
  bundleCheck: false,
  bundleCheckCwd: undefined,
}]
```

### `additionalPureFunctions`

An array of function names that should be treated as pure (side-effect-free). Calls to these functions at module scope will not trigger the `unannotatedCall` warning.

### Auto-fix and Suggestions

- **Enum declarations:** Provides a suggestion to replace `enum` with an `as const` object and type alias
- **Unannotated calls:** Auto-fixes by inserting `/*#__PURE__*/` before the call

### Bundle Check Mode

When `bundleCheck: true`, the rule runs `npx treeshake-check --json` (with a 60-second timeout) and maps the bundle analysis results back to source file locations. Static findings are deduplicated against bundle check results to avoid double-reporting.

## Configs

| Config        | Rule Level | `bundleCheck` |
| ------------- | ---------- | ------------- |
| `recommended` | `warn`     | `false`       |
| `strict`      | `error`    | `true`        |

## Programmatic API

```javascript
import treeshake from '@wolfcola/eslint-plugin-treeshake';

// Access the rule directly
treeshake.rules['no-treeshake-hazard'];

// Access the named export
import { noTreeshakeHazard } from '@wolfcola/eslint-plugin-treeshake';
```
