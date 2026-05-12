---
title: 'Development Setup'
description: 'Set up your local development environment for wolfcola-devtools'
section: contributing
order: 1
---

# Development Setup

## Prerequisites

- Node.js 20, 22, or 24
- pnpm 10.21+
- Nix (recommended, provides all tools automatically)

## Using Nix

```bash
git clone https://github.com/ryanbas21/devtools.git
cd devtools
nix develop
```

The Nix dev shell provides Node.js, pnpm, Elm, and lefthook automatically.

## Without Nix

```bash
git clone https://github.com/ryanbas21/devtools.git
cd devtools
corepack enable
pnpm install
```

<callout type="info">The repository uses Effect TypeScript extensively. See the Code Style guide for Effect conventions.</callout>
