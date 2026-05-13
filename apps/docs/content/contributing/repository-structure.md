---
title: 'Repository Structure'
description: 'How the wolfcola-devtools monorepo is organized'
section: contributing
order: 2
---

# Repository Structure

The wolfcola-devtools repository is a pnpm workspace monorepo. All publishable packages live under the `packages/` directory, and shared tooling lives at the repository root.

## Package Map

| Package                             | Directory                          | Description                                               |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| `@wolfcola/treeshake-check`         | `packages/treeshake-check`         | CLI and library to verify tree-shaking support via Rollup |
| `@wolfcola/eslint-plugin-treeshake` | `packages/eslint-plugin-treeshake` | ESLint plugin that flags patterns breaking tree-shaking   |
| `@wolfcola/devtools-bridge`         | `packages/devtools-bridge`         | SDK adapter for emitting AuthEvent objects to DevTools    |
| `@wolfcola/devtools-types`          | `packages/devtools-types`          | Effect Schema definitions for AuthEvent and FlowState     |
| `@wolfcola/devtools-core`           | `packages/devtools-core`           | Shared annotators, diagnosis engine, event store          |
| `@wolfcola/devtools-ui`             | `packages/devtools-ui`             | Elm UI components for Timeline, Flow, and Learn views     |
| `@wolfcola/devtools-extension`      | `packages/devtools-extension`      | Browser extension for Chrome and Firefox                  |
| `oidc-devtools`                     | `packages/vscode-extension`        | VS Code extension with CDP connection                     |
| `@wolfcola/dead-export-finder`      | `packages/dead-export-finder`      | CLI to find unused exports across monorepo boundaries     |
| `@wolfcola/changeset-sync-manifest` | `packages/changeset-sync-manifest` | Syncs package version from changesets to manifest files   |
| `@wolfcola/docs-site`               | `apps/docs`                        | This documentation site (elm-pages)                       |

## Root Files

| File                  | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `flake.nix`           | Nix flake providing the development shell          |
| `pnpm-workspace.yaml` | Defines the workspace packages                     |
| `package.json`        | Root scripts for build, test, and lint             |
| `tsconfig.json`       | Base TypeScript configuration extended by packages |
| `.changeset/`         | Changeset configuration and pending changesets     |
| `CLAUDE.md`           | Agent instructions for Claude Code                 |
| `CONTEXT.md`          | Domain context for AI assistants                   |
| `docs/adr/`           | Architecture Decision Records                      |

## Build System

The monorepo uses the following tools:

- **pnpm** — Package manager with workspace support. All packages share a single lockfile.
- **TypeScript** — Used by all packages except the docs site. Each package has its own `tsconfig.json` that extends the root config.
- **Vitest** — Test runner for all TypeScript packages. Tests use `@effect/vitest` helpers.
- **Elm** — Used by the docs site. Compiled by elm-pages during the site build.
- **Nix** — Optional but recommended. The `flake.nix` provides Node.js, pnpm, Elm, and lefthook.
- **Lefthook** — Git hooks for pre-commit linting and pre-push testing.
- **Changesets** — Versioning and changelog generation for all publishable packages.

## Dependency Graph

The packages have the following dependency relationships:

```
devtools-extension
  ├── devtools-core
  ├── devtools-ui (Elm)
  └── devtools-types

devtools-bridge
  └── devtools-types

vscode-extension
  └── devtools-types

devtools-core
  └── devtools-types

treeshake-check
  (standalone)

eslint-plugin-treeshake
  (standalone, optional dep on treeshake-check)

dead-export-finder
  (standalone)

changeset-sync-manifest
  (standalone)
```

The `devtools-types` package is the shared foundation. It defines the `AuthEvent` and `FlowState` schemas that the bridge, browser extension, and VS Code extension all depend on.

## Adding a New Package

1. Create a directory under `packages/`
2. Add a `package.json` with the `@wolfcola` scope
3. Add the package to `pnpm-workspace.yaml` if not using a glob pattern
4. Add a `tsconfig.json` extending the root config
5. Add the package to the sidebar in `apps/docs/app/Shared.elm`
6. Create a content page in `apps/docs/content/packages/`
7. Create a content page in `apps/docs/content/docs/` for integration guides
