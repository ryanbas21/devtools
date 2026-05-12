---
title: '@wolfcola/treeshake-check'
description: 'CLI & library to verify packages are tree-shakeable by Rollup'
section: packages
order: 1
---

# @wolfcola/treeshake-check

Verify that your npm packages are properly tree-shakeable.

## Installation

```bash
npm install -D @wolfcola/treeshake-check
```

## CLI Usage

```bash
npx treeshake-check <package-name>
```

Checks whether importing individual exports from a package produces minimal bundles via Rollup.

<callout type="warning">This tool uses Rollup internally. Ensure Rollup is available in your project.</callout>
