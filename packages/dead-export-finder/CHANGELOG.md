# @wolfcola/dead-export-finder

## 1.2.0

## 1.1.1

### Patch Changes

- [#53](https://github.com/ryanbas21/devtools/pull/53) [`7e9a298`](https://github.com/ryanbas21/devtools/commit/7e9a29874918ecb3e16b62b227ab22ad13496471) Thanks [@ryanbas21](https://github.com/ryanbas21)! - fix(dead-export-finder): resolve false negatives hiding all dead exports
  - Fix empty package filter caused by `Options.repeated` + `Options.optional` returning `Some([])` instead of `None`, which silently filtered out all packages and reported zero dead exports
  - Inherit `.gitignore` patterns from workspace root so `dist/` build artifacts are excluded from per-package scans
  - Add default ignore patterns for config files (`*.config.{ts,mjs,cjs,js}`) that export for tooling, not for code

## 1.1.0
