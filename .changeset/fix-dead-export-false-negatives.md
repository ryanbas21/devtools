---
'@wolfcola/dead-export-finder': patch
---

fix(dead-export-finder): resolve false negatives hiding all dead exports

- Fix empty package filter caused by `Options.repeated` + `Options.optional` returning `Some([])` instead of `None`, which silently filtered out all packages and reported zero dead exports
- Inherit `.gitignore` patterns from workspace root so `dist/` build artifacts are excluded from per-package scans
- Add default ignore patterns for config files (`*.config.{ts,mjs,cjs,js}`) that export for tooling, not for code
