# @wolfcola/changeset-sync-manifest Design

**Problem:** The Chrome extension `manifest.json` version is hardcoded at `0.1.0` and never bumped by changesets. Every CWS publish overwrites the same display version.

**Solution:** A small CLI package that runs after `changeset version` and copies the `package.json` version into `manifest.json` for a given package directory.

## Package

- **Name:** `@wolfcola/changeset-sync-manifest`
- **Location:** `packages/changeset-sync-manifest`
- **Private:** yes

### Files

| File                   | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `package.json`         | Package manifest with `bin` entry                                    |
| `bin/sync-manifest.js` | Compiled CLI entry point                                             |
| `src/sync.ts`          | Pure function: read `package.json` version, write to `manifest.json` |
| `src/sync.test.ts`     | Unit tests                                                           |

### CLI Interface

```
sync-manifest <dir>
```

- `<dir>` — path to a package directory containing both `package.json` and `manifest.json`
- Reads `<dir>/package.json` → extracts `version`
- Reads `<dir>/manifest.json` → sets `version` field → writes back
- Exits non-zero if either file is missing or JSON is malformed

### Pure Function

```ts
syncManifestVersion(dir: string): void
```

Reads `package.json` and `manifest.json` from `dir`, copies the version, writes `manifest.json` back with the updated version. Preserves existing formatting (2-space indent, trailing newline).

## Integration

### Changesets config (`.changeset/config.json`)

- Add `"privatePackages": { "version": true }` so changesets bumps private packages
- Remove `@wolfcola/devtools-extension` from `ignore` so it participates in the `@wolfcola/*` fixed group

### Version script (root `package.json`)

```
"version": "changeset version && sync-manifest packages/devtools-extension && prettier --write '**/package.json' pnpm-workspace.yaml"
```

### Build pipeline (unchanged)

`build.mjs` continues reading `manifest.json` and calling `stampVersion()` to append the CI build number as the 4th version segment. The only difference is that the base version in `manifest.json` now reflects the real package version instead of a hardcoded `0.1.0`.

## What this does NOT do

- Does not handle the VS Code extension (its `package.json` is its manifest — changesets handles it directly if removed from `ignore`)
- Does not scan the workspace automatically — takes an explicit directory argument
- Does not handle jsonpath or arbitrary file targets — just `package.json` → `manifest.json` version sync
