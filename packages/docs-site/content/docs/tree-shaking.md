---
title: 'Tree-Shaking Your Packages'
description: 'Verify and improve tree-shaking support in your npm packages'
section: guides
order: 4
---

# Tree-Shaking Your Packages

Tree-shaking is the process by which bundlers like Rollup, Webpack, and esbuild eliminate unused code from your final bundle. The wolfcola devtools suite includes two packages to help you verify and enforce tree-shaking support: `@wolfcola/treeshake-check` (a CLI and library) and `@wolfcola/eslint-plugin-treeshake` (a linting plugin).

## Why Tree-Shaking Matters

If your package is not tree-shakeable, consumers pay the cost of importing your entire library even when they only use a single function. This directly impacts:

- **Bundle size** — larger downloads for end users
- **Parse time** — browsers must parse unused code
- **Memory usage** — unused modules still occupy memory in some runtimes

## Using treeshake-check

The `treeshake-check` CLI verifies that each export from your package produces a minimal bundle when imported individually through Rollup.

### Installation

```bash
npm install -D @wolfcola/treeshake-check
```

### Running the Check

```bash
npx treeshake-check your-package-name
```

The tool will:

1. Discover all named exports from your package
2. Create a minimal Rollup bundle importing each export individually
3. Compare the bundle size against a threshold
4. Report which exports are tree-shakeable and which are not

### CI Integration

Add a check to your CI pipeline to catch tree-shaking regressions:

```json
{
  "scripts": {
    "check:treeshake": "treeshake-check your-package-name"
  }
}
```

The CLI exits with code 1 if any export fails the tree-shaking check.

## Using eslint-plugin-treeshake

The ESLint plugin catches common patterns that break tree-shaking at the source level, before you even publish.

### Installation

```bash
npm install -D @wolfcola/eslint-plugin-treeshake
```

### Configuration

With ESLint flat config:

```javascript
import treeshake from '@wolfcola/eslint-plugin-treeshake';

export default [treeshake.configs.recommended];
```

### Rules

The plugin includes rules that flag:

- **Top-level side effects** — code that runs at module evaluation time prevents the export from being eliminated
- **Mutable module-scope variables** — `let` or `var` at module scope that are read by exported functions create implicit dependencies
- **Class static initializers with side effects** — static blocks or property initializers that call external functions
- **Barrel file anti-patterns** — re-export-all patterns (`export * from`) that defeat bundler analysis

<callout type="info">The `treeshake-check` CLI and `eslint-plugin-treeshake` complement each other. The CLI tests your built output; the ESLint plugin catches problems in source code.</callout>

## Common Fixes

### Avoid Top-Level Side Effects

```typescript
// Bad - side effect at module scope
const registry = new Map();
registry.set('default', createDefault());

// Good - lazy initialization
const getRegistry = () => {
  const registry = new Map();
  registry.set('default', createDefault());
  return registry;
};
```

### Use Named Exports

```typescript
// Bad - default export of object
export default { foo, bar, baz };

// Good - named exports
export { foo, bar, baz };
```

### Mark Packages as Side-Effect-Free

Add to your `package.json`:

```json
{
  "sideEffects": false
}
```

This tells bundlers that any unused import from your package can be safely removed.
