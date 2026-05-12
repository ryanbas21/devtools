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

Run the CLI:

```bash
npx treeshake-check your-package
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
