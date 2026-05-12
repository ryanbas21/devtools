---
title: 'Getting Started'
description: 'Install and configure wolfcola devtools'
section: guides
order: 1
---

# Getting Started

Install the wolfcola devtools packages you need.

## Tree-Shake Verification

```bash
npm install -D @wolfcola/treeshake-check
```

Run the CLI from your package directory:

```bash
npx treeshake-check
```

Or point it at a specific package:

```bash
npx treeshake-check --cwd packages/my-lib
```

## OIDC DevTools

Install the bridge SDK to emit events from your OIDC client:

```bash
npm install @wolfcola/devtools-bridge
```

<callout type="info">The devtools bridge is framework-agnostic and works with any OIDC client.</callout>

## Next Steps

- Read the [Tree-Shaking Guide](/docs/tree-shaking)
- Explore the [Architecture](/architecture)
- Learn about the [DevTools Extension](/docs/devtools-extension)
