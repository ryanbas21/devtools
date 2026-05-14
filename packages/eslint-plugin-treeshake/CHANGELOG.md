# @wolfcola/eslint-plugin-treeshake

## 1.1.1

## 1.1.0

## 1.0.0

### Minor Changes

- [#19](https://github.com/ryanbas21/devtools/pull/19) [`af083b7`](https://github.com/ryanbas21/devtools/commit/af083b7f3980793b6d4d8a6f35720eab207a6810) Thanks [@ryanbas21](https://github.com/ryanbas21)! - Add @wolfcola/eslint-plugin-treeshake - an ESLint plugin that flags code patterns known to break tree-shaking.

  Implements a single rule `wolfcola/no-treeshake-hazard` with static checks for:
  - TypeScript enums (with `as const` suggestion)
  - Unannotated top-level calls (with `/*#__PURE__*/` autofix)
  - Prototype/property mutations at module scope
  - Global object assignments
  - CommonJS patterns in ESM files
  - Missing `sideEffects` field in package.json

  Includes opt-in `bundleCheck` mode that runs `@wolfcola/treeshake-check`'s full Rollup analysis and maps results back to source locations, with deduplication against static findings.

  Ships with `recommended` (warn) and `strict` (error + bundleCheck) preset configs.
