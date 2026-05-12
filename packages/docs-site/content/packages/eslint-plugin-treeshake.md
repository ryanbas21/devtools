---
title: '@wolfcola/eslint-plugin-treeshake'
description: 'ESLint plugin that flags tree-breaking patterns'
section: packages
order: 2
---

# @wolfcola/eslint-plugin-treeshake

An ESLint plugin that statically analyzes your source code for patterns known to break tree-shaking in JavaScript bundlers.

## Installation

```bash
npm install -D @wolfcola/eslint-plugin-treeshake
```

## Configuration

### ESLint Flat Config (recommended)

```javascript
import treeshake from '@wolfcola/eslint-plugin-treeshake';

export default [treeshake.configs.recommended];
```

### Legacy `.eslintrc`

```json
{
  "plugins": ["@wolfcola/treeshake"],
  "extends": ["plugin:@wolfcola/treeshake/recommended"]
}
```

## Rules

### `treeshake/no-top-level-side-effects`

Disallows expressions at module scope that produce side effects. Side effects at the top level prevent bundlers from removing the module even when none of its exports are used.

**Bad:**

```typescript
// This runs when the module is imported, even if nothing is used
console.log('module loaded');
const el = document.createElement('div');
```

**Good:**

```typescript
// Side effects are deferred to function calls
export const init = () => {
  console.log('module loaded');
  const el = document.createElement('div');
  return el;
};
```

### `treeshake/no-mutable-module-scope`

Flags `let` and `var` declarations at module scope that are read by exported functions. Mutable bindings create implicit dependencies that bundlers cannot safely eliminate.

**Bad:**

```typescript
let count = 0;
export const increment = () => ++count;
```

**Good:**

```typescript
export const createCounter = () => {
  let count = 0;
  return { increment: () => ++count };
};
```

### `treeshake/no-export-star`

Warns against `export * from "..."` patterns. Barrel files that re-export everything from sub-modules make it difficult for bundlers to determine which exports are actually used.

**Bad:**

```typescript
export * from './utils';
export * from './helpers';
```

**Good:**

```typescript
export { formatDate, parseDate } from './utils';
export { capitalize } from './helpers';
```

### `treeshake/no-class-side-effects`

Detects class declarations with static initializers that call external functions. Static blocks and property initializers run at class definition time, creating side effects.

<callout type="info">All rules are enabled by the `recommended` config preset. You can disable individual rules in your ESLint config if needed.</callout>

## Programmatic API

The plugin exports its rules for use in custom ESLint configurations:

```javascript
import treeshake from '@wolfcola/eslint-plugin-treeshake';

// Access individual rules
treeshake.rules['no-top-level-side-effects'];
treeshake.rules['no-mutable-module-scope'];
```
