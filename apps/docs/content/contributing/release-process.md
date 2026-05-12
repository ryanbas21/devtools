---
title: 'Release Process'
description: 'How to version and publish wolfcola-devtools packages'
section: contributing
order: 4
---

# Release Process

The wolfcola-devtools monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing packages to npm.

## Overview

The release workflow is:

1. Contributors add changesets to their pull requests
2. A "Version Packages" PR is automatically maintained by the Changesets GitHub Action
3. When the Version Packages PR is merged, packages are published to npm

## Adding a Changeset

Every pull request that modifies a publishable package must include a changeset. Run:

```bash
pnpm changeset
```

The interactive prompt will ask you to:

1. **Select packages** — choose which packages are affected by your change
2. **Select bump type** — `patch` for bug fixes, `minor` for new features, `major` for breaking changes
3. **Write a summary** — describe what changed and why

This creates a Markdown file in `.changeset/` with the change metadata:

```markdown
---
'@wolfcola/treeshake-check': patch
---

Fixed false positive when checking packages with conditional exports.
```

### Multiple Packages

If your change affects multiple packages, select all of them in the prompt. Each can have a different bump level:

```markdown
---
'@wolfcola/devtools-types': minor
'@wolfcola/devtools-bridge': patch
---

Added new FlowError type to devtools-types. Updated devtools-bridge to use it.
```

### Changeset Guidelines

- Write in imperative mood ("Add feature" not "Added feature")
- Include context about why the change was made, not just what
- If the change is a breaking change, describe the migration path
- One changeset per logical change — split unrelated changes into separate PRs

## Version Packages PR

The Changesets GitHub Action runs on every push to `main`. It:

1. Collects all changeset files in `.changeset/`
2. Calculates the new version for each affected package
3. Updates `package.json` versions and `CHANGELOG.md` files
4. Opens (or updates) a "Version Packages" pull request

The Version Packages PR shows all pending changes and the resulting version bumps. Review it to make sure the versions look correct.

## Publishing

When the Version Packages PR is merged:

1. The CI workflow detects the version bump commits
2. It runs the full test suite
3. It builds all affected packages
4. It publishes updated packages to npm with `pnpm publish -r`

### Manual Publishing

In rare cases, you may need to publish manually:

```bash
pnpm changeset version  # Apply version bumps
pnpm install            # Update lockfile
pnpm -r build           # Build all packages
pnpm changeset publish  # Publish to npm
```

<callout type="warning">Manual publishing should be a last resort. Always prefer the automated workflow via the Version Packages PR.</callout>

## Pre-releases

For testing unreleased versions:

```bash
pnpm changeset pre enter next
pnpm changeset version
pnpm changeset publish
```

This publishes packages with a `next` dist-tag (e.g. `1.2.0-next.0`) so they do not affect the `latest` tag.

To exit pre-release mode:

```bash
pnpm changeset pre exit
```

## Version Policy

- **Patch** (`0.0.x`) — Bug fixes, documentation updates, internal refactors
- **Minor** (`0.x.0`) — New features, new exports, new optional fields in schemas
- **Major** (`x.0.0`) — Breaking changes to public APIs, removed exports, changed schema shapes
