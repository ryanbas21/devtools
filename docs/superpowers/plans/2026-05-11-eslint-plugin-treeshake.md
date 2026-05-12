# ESLint Plugin Treeshake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@wolfcola/eslint-plugin-treeshake` — an ESLint plugin with a single `wolfcola/no-treeshake-hazard` rule that flags code patterns breaking tree-shaking, with opt-in Rollup-based bundle checking via `@wolfcola/treeshake-check`.

**Architecture:** A standalone ESLint flat-config plugin using AST visitors for five hazard categories (enums, unannotated calls, prototype mutation, global assignment, CJS patterns). A known-pure allowlist and `/*#__PURE__*/` autofix reduce false positives. An optional `bundleCheck` mode delegates to `@wolfcola/treeshake-check` and maps Rollup results back to source locations, deduplicating against static findings.

**Tech Stack:** TypeScript, ESLint 9 flat config, `@typescript-eslint/parser`, `@typescript-eslint/utils` (for `RuleTester` and typed AST helpers), vitest, `@wolfcola/treeshake-check` (optional dep for bundle check mode).

**Spec:** `docs/superpowers/specs/2026-05-11-eslint-plugin-treeshake-design.md`

---

## File Structure

```
packages/eslint-plugin-treeshake/
  package.json
  tsconfig.json
  tsconfig.lib.json
  tsconfig.spec.json
  eslint.config.mjs
  vitest.config.mts
  README.md
  src/
    index.ts                          # Plugin entry: exports rules + configs
    lib/
      known-pure.ts                   # KNOWN_PURE_CALLS set
      known-pure.test.ts
      explanations.ts                 # Cause explanations (standalone)
      scope-utils.ts                  # isModuleScope() helper
      scope-utils.test.ts
      no-treeshake-hazard.ts          # The rule implementation
      no-treeshake-hazard.test.ts
      bundle-check.ts                 # Bundle-check integration
      bundle-check.test.ts
      snippet-match.ts                # Map surviving code → source locations
      snippet-match.test.ts
```

---

### Task 1: Scaffold package boilerplate

**Files:**

- Create: `packages/eslint-plugin-treeshake/package.json`
- Create: `packages/eslint-plugin-treeshake/tsconfig.json`
- Create: `packages/eslint-plugin-treeshake/tsconfig.lib.json`
- Create: `packages/eslint-plugin-treeshake/tsconfig.spec.json`
- Create: `packages/eslint-plugin-treeshake/vitest.config.mts`
- Create: `packages/eslint-plugin-treeshake/eslint.config.mjs`
- Modify: `tsconfig.json` (root — add project reference)

- [ ] **Step 1: Create `packages/eslint-plugin-treeshake/package.json`**

```json
{
  "name": "@wolfcola/eslint-plugin-treeshake",
  "version": "0.0.0",
  "description": "ESLint plugin that flags code patterns known to break tree-shaking",
  "license": "MIT",
  "type": "module",
  "repository": {
    "type": "git",
    "url": "https://github.com/ryanbas21/devtools.git",
    "directory": "packages/eslint-plugin-treeshake"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "!dist/*.tsbuildinfo"],
  "scripts": {
    "build": "tsc -p tsconfig.lib.json",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@typescript-eslint/utils": "^8.45.0"
  },
  "peerDependencies": {
    "eslint": ">=9.0.0",
    "@typescript-eslint/parser": ">=8.0.0"
  },
  "optionalDependencies": {
    "@wolfcola/treeshake-check": "workspace:*"
  },
  "devDependencies": {
    "vitest": "catalog:vitest",
    "@typescript-eslint/rule-tester": "^8.45.0"
  }
}
```

- [ ] **Step 2: Create `packages/eslint-plugin-treeshake/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

- [ ] **Step 3: Create `packages/eslint-plugin-treeshake/tsconfig.lib.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
    "emitDeclarationOnly": false,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "importHelpers": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["vitest.config.mts", "src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `packages/eslint-plugin-treeshake/tsconfig.spec.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    "types": ["vitest/globals", "vitest/importMeta", "vite/client", "node", "vitest"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "importHelpers": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vitest.config.mts", "src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.d.ts"],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 5: Create `packages/eslint-plugin-treeshake/vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/eslint-plugin-treeshake',
  test: {
    name: 'eslint-plugin-treeshake',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
```

- [ ] **Step 6: Create `packages/eslint-plugin-treeshake/eslint.config.mjs`**

```js
import baseConfig from '../../eslint.config.mjs';

export default [{ ignores: ['**/dist'] }, ...baseConfig, { files: ['**/*.ts'], rules: {} }];
```

- [ ] **Step 7: Add project reference to root `tsconfig.json`**

Add `{ "path": "packages/eslint-plugin-treeshake" }` to the `references` array in the root `tsconfig.json`.

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`
Expected: lockfile updates, dependencies resolve

- [ ] **Step 9: Verify build scaffolding**

Run: `cd packages/eslint-plugin-treeshake && pnpm tsc -p tsconfig.lib.json --noEmit`
Expected: No errors (no source files yet, should be clean)

- [ ] **Step 10: Commit**

```bash
git add packages/eslint-plugin-treeshake tsconfig.json pnpm-lock.yaml
git commit -m "chore: scaffold eslint-plugin-treeshake package"
```

---

### Task 2: Known-pure allowlist

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/lib/known-pure.ts`
- Create: `packages/eslint-plugin-treeshake/src/lib/known-pure.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/eslint-plugin-treeshake/src/lib/known-pure.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isKnownPure, KNOWN_PURE_CALLS } from './known-pure.js';

describe('isKnownPure', () => {
  it('recognizes Object.freeze as pure', () => {
    expect(isKnownPure('Object.freeze')).toBe(true);
  });

  it('recognizes Symbol.for as pure', () => {
    expect(isKnownPure('Symbol.for')).toBe(true);
  });

  it('rejects unknown functions', () => {
    expect(isKnownPure('initializeGlobals')).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isKnownPure('Object')).toBe(false);
  });

  it('accepts user-provided additional pure functions', () => {
    expect(isKnownPure('myPureHelper', ['myPureHelper'])).toBe(true);
  });

  it('does not accept user-provided functions without passing them', () => {
    expect(isKnownPure('myPureHelper')).toBe(false);
  });
});

describe('KNOWN_PURE_CALLS', () => {
  it('contains expected built-in entries', () => {
    expect(KNOWN_PURE_CALLS.has('Object.freeze')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Object.create')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Array.from')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Symbol')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Symbol.for')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('JSON.parse')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('JSON.stringify')).toBe(true);
    expect(KNOWN_PURE_CALLS.has('Promise.resolve')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/known-pure.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/eslint-plugin-treeshake/src/lib/known-pure.ts`:

```ts
export const KNOWN_PURE_CALLS: ReadonlySet<string> = new Set([
  // Object
  'Object.freeze',
  'Object.create',
  'Object.keys',
  'Object.values',
  'Object.entries',
  'Object.fromEntries',
  // Symbol
  'Symbol',
  'Symbol.for',
  // Array
  'Array.from',
  'Array.of',
  'Array.isArray',
  // Collections (constructor calls with `new` are separate — these are bare calls)
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  // Number
  'Number.isNaN',
  'Number.isFinite',
  'Number.parseInt',
  'Number.parseFloat',
  // String
  'String.fromCharCode',
  'String.fromCodePoint',
  // JSON
  'JSON.parse',
  'JSON.stringify',
  // Math
  'Math.max',
  'Math.min',
  'Math.floor',
  'Math.ceil',
  'Math.round',
  'Math.abs',
  // Promise
  'Promise.resolve',
  'Promise.reject',
]);

/**
 * Check whether a callee name (e.g. "Object.freeze" or "myHelper") is
 * known to be side-effect-free. Accepts an optional list of additional
 * user-provided pure function names.
 */
export const isKnownPure = (
  calleeName: string,
  additionalPureFunctions: ReadonlyArray<string> = [],
): boolean => KNOWN_PURE_CALLS.has(calleeName) || additionalPureFunctions.includes(calleeName);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/known-pure.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/known-pure.ts packages/eslint-plugin-treeshake/src/lib/known-pure.test.ts
git commit -m "feat(eslint-plugin-treeshake): add known-pure allowlist"
```

---

### Task 3: Explanations (standalone copy)

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/lib/explanations.ts`

This is a standalone copy of the cause explanations, adapted for ESLint diagnostic messages. No tests needed — it's a static data map.

- [ ] **Step 1: Create the explanations file**

Create `packages/eslint-plugin-treeshake/src/lib/explanations.ts`:

```ts
export type HazardCategory =
  | 'EnumPattern'
  | 'UnannotatedCall'
  | 'PrototypeMutation'
  | 'GlobalAssignment'
  | 'CjsPatterns'
  | 'TopLevelSideEffect'
  | 'MissingSideEffectsField'
  | 'Unknown';

export interface HazardExplanation {
  readonly messageId: string;
  readonly summary: string;
  readonly why: string;
  readonly fix: string;
}

export const EXPLANATIONS: Record<HazardCategory, HazardExplanation> = {
  EnumPattern: {
    messageId: 'enumPattern',
    summary: 'TypeScript enum breaks tree-shaking.',
    why: 'TypeScript compiles `enum` to an IIFE that mutates a module-scoped variable. Bundlers keep the entire module.',
    fix: 'Replace with an `as const` object and a derived type alias.',
  },
  UnannotatedCall: {
    messageId: 'unannotatedCall',
    summary: 'Top-level function call without /*#__PURE__*/ annotation.',
    why: 'Bundlers treat bare function calls at module scope as side-effectful and cannot eliminate them.',
    fix: 'Add /*#__PURE__*/ before the call if it has no side effects, or move it inside an exported function.',
  },
  PrototypeMutation: {
    messageId: 'prototypeMutation',
    summary: 'Prototype or property mutation at module scope breaks tree-shaking.',
    why: 'Object.defineProperty, Object.assign, or .prototype assignments at the top level are observable side effects.',
    fix: 'Move the mutation inside a function, or annotate with /*#__PURE__*/ if genuinely side-effect-free.',
  },
  GlobalAssignment: {
    messageId: 'globalAssignment',
    summary: 'Assignment to a global object at module scope breaks tree-shaking.',
    why: 'Assignments to window/globalThis/self/global are observable side effects that bundlers can never eliminate.',
    fix: 'Move the assignment into an explicitly-invoked function or a separate entry point.',
  },
  CjsPatterns: {
    messageId: 'cjsPatterns',
    summary: 'CommonJS pattern in an ESM file prevents tree-shaking.',
    why: 'require(), module.exports, and __esModule markers indicate CommonJS, which bundlers cannot statically analyze.',
    fix: 'Use ESM import/export syntax. Ensure your build emits ESM output.',
  },
  TopLevelSideEffect: {
    messageId: 'topLevelSideEffect',
    summary: 'Top-level statement with side effects prevents tree-shaking.',
    why: 'This statement runs when the module is imported and the bundler cannot prove it is safe to remove.',
    fix: 'Move side-effecting code into an exported function, or annotate pure expressions with /*#__PURE__*/.',
  },
  MissingSideEffectsField: {
    messageId: 'missingSideEffectsField',
    summary: 'package.json is missing the "sideEffects" field.',
    why: 'Without "sideEffects": false, bundlers conservatively assume every module may have side effects, blocking aggressive tree-shaking.',
    fix: 'Add "sideEffects": false to package.json. If some files do have side effects, use an array: "sideEffects": ["./src/polyfill.ts"].',
  },
  Unknown: {
    messageId: 'unknown',
    summary: 'Unknown tree-shaking hazard detected by bundle analysis.',
    why: 'The bundler kept this code but no specific pattern was matched.',
    fix: 'Inspect the surviving code manually. Common causes: getters, decorators, destructuring with defaults, class field initializers.',
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/eslint-plugin-treeshake && pnpm tsc -p tsconfig.lib.json --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/explanations.ts
git commit -m "feat(eslint-plugin-treeshake): add hazard explanations"
```

---

### Task 4: Scope utilities

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/lib/scope-utils.ts`
- Create: `packages/eslint-plugin-treeshake/src/lib/scope-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/eslint-plugin-treeshake/src/lib/scope-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getCalleeName } from './scope-utils.js';

describe('getCalleeName', () => {
  it('returns name for simple identifier', () => {
    // Simulates: `foo()` → callee is Identifier { name: "foo" }
    const node = { type: 'Identifier', name: 'foo' } as const;
    expect(getCalleeName(node as any)).toBe('foo');
  });

  it('returns dotted name for member expression', () => {
    // Simulates: `Object.freeze()` → callee is MemberExpression
    const node = {
      type: 'MemberExpression',
      computed: false,
      object: { type: 'Identifier', name: 'Object' },
      property: { type: 'Identifier', name: 'freeze' },
    } as const;
    expect(getCalleeName(node as any)).toBe('Object.freeze');
  });

  it('returns null for computed member expression', () => {
    const node = {
      type: 'MemberExpression',
      computed: true,
      object: { type: 'Identifier', name: 'obj' },
      property: { type: 'Literal', value: 'foo' },
    } as const;
    expect(getCalleeName(node as any)).toBeNull();
  });

  it('returns null for complex callee', () => {
    // Simulates: `getObj().method()`
    const node = {
      type: 'MemberExpression',
      computed: false,
      object: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'getObj' },
        arguments: [],
      },
      property: { type: 'Identifier', name: 'method' },
    } as const;
    expect(getCalleeName(node as any)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/scope-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/eslint-plugin-treeshake/src/lib/scope-utils.ts`:

```ts
import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Check whether a node is at the top level of a module (direct child of Program.body).
 * We walk up the parent chain looking for function/class boundaries.
 * If we hit Program without crossing a function/class/arrow, the node is at module scope.
 */
export const isModuleScope = (node: TSESTree.Node): boolean => {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    switch (current.type) {
      case 'Program':
        return true;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassBody':
      case 'StaticBlock':
        return false;
    }
    current = current.parent;
  }
  return false;
};

/**
 * Extract a human-readable callee name from a CallExpression's callee node.
 * Returns "Object.freeze" for `Object.freeze(...)`, "foo" for `foo(...)`,
 * or null for computed/complex expressions.
 */
export const getCalleeName = (callee: TSESTree.Expression): string | null => {
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    return `${callee.object.name}.${callee.property.name}`;
  }
  return null;
};

/**
 * Check whether a node has a leading /*#__PURE__*\/ comment.
 */
export const hasPureAnnotation = (
  sourceCode: { getCommentsBefore(node: TSESTree.Node): TSESTree.Comment[] },
  node: TSESTree.Node,
): boolean => {
  const comments = sourceCode.getCommentsBefore(node);
  return comments.some((c) => c.type === 'Block' && c.value.trim() === '#__PURE__');
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/scope-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/scope-utils.ts packages/eslint-plugin-treeshake/src/lib/scope-utils.test.ts
git commit -m "feat(eslint-plugin-treeshake): add scope utilities"
```

---

### Task 5: Snippet matching utility

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/lib/snippet-match.ts`
- Create: `packages/eslint-plugin-treeshake/src/lib/snippet-match.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/eslint-plugin-treeshake/src/lib/snippet-match.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findSnippetLocation } from './snippet-match.js';

describe('findSnippetLocation', () => {
  const source = [
    'import { foo } from "bar";',
    '',
    'const x = createStore();',
    '',
    'export { x };',
  ].join('\n');

  it('finds a snippet and returns the correct line/column', () => {
    const result = findSnippetLocation(source, 'createStore()');
    expect(result).toEqual({ line: 3, column: 10 });
  });

  it('returns null when snippet is not found', () => {
    const result = findSnippetLocation(source, 'notInSource()');
    expect(result).toBeNull();
  });

  it('finds snippet on the first line', () => {
    const result = findSnippetLocation(source, 'import');
    expect(result).toEqual({ line: 1, column: 0 });
  });

  it('handles multi-line snippets by matching the first line', () => {
    const multiLine = 'const x = createStore();\n\nexport { x };';
    const result = findSnippetLocation(source, multiLine);
    expect(result).toEqual({ line: 3, column: 0 });
  });

  it('returns null for empty snippet', () => {
    const result = findSnippetLocation(source, '');
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only snippet', () => {
    const result = findSnippetLocation(source, '   \n  ');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/snippet-match.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/eslint-plugin-treeshake/src/lib/snippet-match.ts`:

```ts
export interface SourceLocation {
  /** 1-based line number */
  readonly line: number;
  /** 0-based column offset */
  readonly column: number;
}

/**
 * Find where a code snippet appears in a source string.
 * For multi-line snippets, matches the first non-empty line of the snippet.
 * Returns null if not found or snippet is empty/whitespace.
 */
export const findSnippetLocation = (source: string, snippet: string): SourceLocation | null => {
  const trimmed = snippet.trim();
  if (trimmed.length === 0) return null;

  // For multi-line snippets, match on the first non-empty line
  const firstLine = trimmed.split('\n').find((l) => l.trim().length > 0);
  if (!firstLine) return null;

  const searchTarget = firstLine.trim();
  const index = source.indexOf(searchTarget);
  if (index === -1) return null;

  // Convert char index to line/column
  const before = source.slice(0, index);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  const column = lastNewline === -1 ? index : index - lastNewline - 1;

  return { line, column };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/snippet-match.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/snippet-match.ts packages/eslint-plugin-treeshake/src/lib/snippet-match.test.ts
git commit -m "feat(eslint-plugin-treeshake): add snippet-match utility"
```

---

### Task 6: The rule — static checks

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts`
- Create: `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.test.ts`

This is the largest task. We build the rule with all five static hazard checks plus the `MissingSideEffectsField` check. The `bundleCheck` option is stubbed as a no-op here and implemented in Task 7.

- [ ] **Step 1: Write the failing tests**

Create `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.test.ts`:

```ts
import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it, afterAll } from 'vitest';
import { rule } from './no-treeshake-hazard.js';

// RuleTester requires this for vitest
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
});

// ─── EnumPattern ──────────────────────────────────────────────────────────────

tester.run('no-treeshake-hazard (enum)', rule, {
  valid: [
    // as const object is fine
    {
      code: `export const Direction = { Up: "UP", Down: "DOWN" } as const;`,
    },
    // enum inside a function is fine (not module scope)
    {
      code: `function foo() { enum Direction { Up, Down } }`,
    },
    // disabled via options
    {
      code: `export enum Direction { Up, Down }`,
      options: [{ checkEnums: false }],
    },
  ],
  invalid: [
    {
      code: `export enum Direction { Up, Down }`,
      errors: [{ messageId: 'enumPattern' }],
    },
    {
      code: `enum Status { Active = "ACTIVE", Inactive = "INACTIVE" }`,
      errors: [{ messageId: 'enumPattern' }],
    },
    {
      code: `const enum Flags { A = 1, B = 2 }`,
      errors: [{ messageId: 'enumPattern' }],
    },
  ],
});

// ─── UnannotatedCall ──────────────────────────────────────────────────────────

tester.run('no-treeshake-hazard (unannotated call)', rule, {
  valid: [
    // Inside a function — not module scope
    { code: `function setup() { initialize(); }` },
    // PURE-annotated
    { code: `const x = /*#__PURE__*/ createStore();` },
    // Known-pure call
    { code: `const frozen = Object.freeze({ a: 1 });` },
    // Known-pure: Symbol.for
    { code: `const SYM = Symbol.for("my-sym");` },
    // User-provided pure function
    {
      code: `const x = myHelper();`,
      options: [{ additionalPureFunctions: ['myHelper'] }],
    },
    // Disabled via options
    {
      code: `initialize();`,
      options: [{ checkUnannotatedCalls: false }],
    },
    // Import statement is not a call
    { code: `import { foo } from 'bar';` },
    // Variable declaration without call
    { code: `const x = 42;` },
  ],
  invalid: [
    {
      code: `initialize();`,
      errors: [{ messageId: 'unannotatedCall' }],
    },
    {
      code: `const store = createStore();`,
      errors: [{ messageId: 'unannotatedCall' }],
    },
    {
      // Autofix test: inserts /*#__PURE__*/
      code: `const x = computeOnce();`,
      errors: [{ messageId: 'unannotatedCall' }],
      output: `const x = /*#__PURE__*/ computeOnce();`,
    },
    {
      // Bare call expression statement
      code: `setup();\nexport const x = 1;`,
      errors: [{ messageId: 'unannotatedCall' }],
      output: `/*#__PURE__*/ setup();\nexport const x = 1;`,
    },
  ],
});

// ─── PrototypeMutation ────────────────────────────────────────────────────────

tester.run('no-treeshake-hazard (prototype mutation)', rule, {
  valid: [
    // Inside a function
    { code: `function init() { Object.defineProperty(obj, "x", { value: 1 }); }` },
    // Not a known mutation method
    { code: `Object.keys(myObj);` },
    // Disabled
    {
      code: `Object.defineProperty(obj, "x", { value: 1 });`,
      options: [{ checkPrototypeMutation: false }],
    },
  ],
  invalid: [
    {
      code: `Object.defineProperty(MyClass.prototype, "foo", { value: 1 });`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Object.defineProperties(obj, { foo: { value: 1 } });`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Object.setPrototypeOf(child, parent);`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Foo.prototype.bar = function() {};`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
  ],
});

// ─── GlobalAssignment ─────────────────────────────────────────────────────────

tester.run('no-treeshake-hazard (global assignment)', rule, {
  valid: [
    // Inside a function
    { code: `function init() { window.x = 1; }` },
    // Reading from global is fine
    { code: `const x = globalThis.crypto;` },
    // Disabled
    {
      code: `window.MY_LIB = {};`,
      options: [{ checkGlobalAssignment: false }],
    },
  ],
  invalid: [
    {
      code: `window.MY_LIB = { version: "1" };`,
      errors: [{ messageId: 'globalAssignment' }],
    },
    {
      code: `globalThis.myApp = {};`,
      errors: [{ messageId: 'globalAssignment' }],
    },
    {
      code: `self.worker = createWorker();`,
      errors: [{ messageId: 'globalAssignment' }],
    },
    {
      code: `global.process = {};`,
      errors: [{ messageId: 'globalAssignment' }],
    },
  ],
});

// ─── CjsPatterns ──────────────────────────────────────────────────────────────

tester.run('no-treeshake-hazard (cjs patterns)', rule, {
  valid: [
    // ESM import is fine
    { code: `import fs from 'fs';` },
    // Inside function
    { code: `function load() { const x = require('foo'); }` },
    // Disabled
    {
      code: `const fs = require('fs');`,
      options: [{ checkCjsPatterns: false }],
    },
  ],
  invalid: [
    {
      code: `const fs = require('fs');`,
      errors: [{ messageId: 'cjsPatterns' }],
    },
    {
      code: `module.exports = { foo: 1 };`,
      errors: [{ messageId: 'cjsPatterns' }],
    },
    {
      code: `exports.foo = bar;`,
      errors: [{ messageId: 'cjsPatterns' }],
    },
  ],
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/no-treeshake-hazard.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the rule implementation**

Create `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts`:

```ts
import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { isModuleScope, getCalleeName, hasPureAnnotation } from './scope-utils.js';
import { isKnownPure } from './known-pure.js';
import { EXPLANATIONS } from './explanations.js';

const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self', 'global']);

const PROTOTYPE_MUTATION_METHODS = new Set([
  'Object.defineProperty',
  'Object.defineProperties',
  'Object.setPrototypeOf',
  'Object.freeze',
  'Object.assign',
]);

// Remove Object.freeze from mutation methods — it's in KNOWN_PURE_CALLS.
// We only flag Object.defineProperty, defineProperties, setPrototypeOf.
const MUTATION_METHODS = new Set([
  'Object.defineProperty',
  'Object.defineProperties',
  'Object.setPrototypeOf',
]);

type RuleOptions = [
  {
    checkEnums?: boolean;
    checkUnannotatedCalls?: boolean;
    checkPrototypeMutation?: boolean;
    checkGlobalAssignment?: boolean;
    checkCjsPatterns?: boolean;
    additionalPureFunctions?: string[];
    bundleCheck?: boolean;
    bundleCheckCwd?: string;
  },
];

type MessageIds =
  | 'enumPattern'
  | 'unannotatedCall'
  | 'prototypeMutation'
  | 'globalAssignment'
  | 'cjsPatterns'
  | 'topLevelSideEffect'
  | 'missingSideEffectsField'
  | 'unknown'
  | 'enumSuggestion';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ryanbas21/devtools/blob/main/packages/eslint-plugin-treeshake/docs/rules/${name}.md`,
);

export const rule = createRule<RuleOptions, MessageIds>({
  name: 'no-treeshake-hazard',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow code patterns that prevent tree-shaking',
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          checkEnums: { type: 'boolean' },
          checkUnannotatedCalls: { type: 'boolean' },
          checkPrototypeMutation: { type: 'boolean' },
          checkGlobalAssignment: { type: 'boolean' },
          checkCjsPatterns: { type: 'boolean' },
          additionalPureFunctions: {
            type: 'array',
            items: { type: 'string' },
          },
          bundleCheck: { type: 'boolean' },
          bundleCheckCwd: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      enumPattern: `${EXPLANATIONS.EnumPattern.summary} ${EXPLANATIONS.EnumPattern.why}`,
      unannotatedCall: `${EXPLANATIONS.UnannotatedCall.summary} ${EXPLANATIONS.UnannotatedCall.fix}`,
      prototypeMutation: `${EXPLANATIONS.PrototypeMutation.summary} ${EXPLANATIONS.PrototypeMutation.why}`,
      globalAssignment: `${EXPLANATIONS.GlobalAssignment.summary} ${EXPLANATIONS.GlobalAssignment.why}`,
      cjsPatterns: `${EXPLANATIONS.CjsPatterns.summary} ${EXPLANATIONS.CjsPatterns.why}`,
      topLevelSideEffect: `${EXPLANATIONS.TopLevelSideEffect.summary} ${EXPLANATIONS.TopLevelSideEffect.why}`,
      missingSideEffectsField: `${EXPLANATIONS.MissingSideEffectsField.summary} ${EXPLANATIONS.MissingSideEffectsField.why}`,
      unknown: `${EXPLANATIONS.Unknown.summary} ${EXPLANATIONS.Unknown.why}`,
      enumSuggestion: 'Replace enum with an `as const` object and type alias.',
    },
  },
  defaultOptions: [
    {
      checkEnums: true,
      checkUnannotatedCalls: true,
      checkPrototypeMutation: true,
      checkGlobalAssignment: true,
      checkCjsPatterns: true,
      additionalPureFunctions: [],
      bundleCheck: false,
    },
  ],
  create(context, [options]) {
    const {
      checkEnums = true,
      checkUnannotatedCalls = true,
      checkPrototypeMutation = true,
      checkGlobalAssignment = true,
      checkCjsPatterns = true,
      additionalPureFunctions = [],
    } = options;

    const sourceCode = context.sourceCode;

    return {
      // ─── Enums ────────────────────────────────────────────────────────
      TSEnumDeclaration(node: TSESTree.TSEnumDeclaration) {
        if (!checkEnums) return;
        if (!isModuleScope(node)) return;

        context.report({
          node,
          messageId: 'enumPattern',
          suggest: [
            {
              messageId: 'enumSuggestion',
              fix(fixer) {
                const members = node.members
                  .map((m) => {
                    const key =
                      m.id.type === 'Identifier'
                        ? m.id.name
                        : `"${(m.id as TSESTree.Literal).value}"`;
                    const value = m.initializer
                      ? sourceCode.getText(m.initializer)
                      : `"${m.id.type === 'Identifier' ? m.id.name : (m.id as TSESTree.Literal).value}"`;
                    return `  ${key}: ${value}`;
                  })
                  .join(',\n');

                const name = node.id.name;
                const exportPrefix = node.parent?.type === 'ExportNamedDeclaration' ? '' : '';
                const constObj = `const ${name} = {\n${members},\n} as const;\ntype ${name} = typeof ${name}[keyof typeof ${name}];`;

                // If the enum is inside an export declaration, we need to
                // replace the parent. Otherwise replace just the enum.
                const target = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;
                const prefix = node.parent?.type === 'ExportNamedDeclaration' ? 'export ' : '';

                return fixer.replaceText(target, `${prefix}${constObj}`);
              },
            },
          ],
        });
      },

      // ─── Unannotated calls ────────────────────────────────────────────
      CallExpression(node: TSESTree.CallExpression) {
        if (!checkUnannotatedCalls) return;
        if (!isModuleScope(node)) return;

        const calleeName = getCalleeName(node.callee);

        // Skip known-pure calls
        if (calleeName && isKnownPure(calleeName, additionalPureFunctions)) {
          return;
        }

        // Skip PURE-annotated calls
        if (hasPureAnnotation(sourceCode, node)) {
          return;
        }

        // Check for prototype mutation (handled separately)
        if (checkPrototypeMutation && calleeName && MUTATION_METHODS.has(calleeName)) {
          return; // Will be reported by the prototype mutation visitor
        }

        context.report({
          node,
          messageId: 'unannotatedCall',
          fix(fixer) {
            return fixer.insertTextBefore(node, '/*#__PURE__*/ ');
          },
        });
      },

      // ─── Prototype mutation via call ──────────────────────────────────
      'ExpressionStatement > CallExpression'(node: TSESTree.CallExpression) {
        if (!checkPrototypeMutation) return;
        if (!isModuleScope(node)) return;

        const calleeName = getCalleeName(node.callee);
        if (calleeName && MUTATION_METHODS.has(calleeName)) {
          context.report({ node, messageId: 'prototypeMutation' });
        }
      },

      // ─── Prototype mutation via assignment ────────────────────────────
      'ExpressionStatement > AssignmentExpression'(node: TSESTree.AssignmentExpression) {
        if (!checkPrototypeMutation) return;
        if (!isModuleScope(node)) return;

        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'MemberExpression' &&
          !node.left.object.computed &&
          node.left.object.property.type === 'Identifier' &&
          node.left.object.property.name === 'prototype'
        ) {
          context.report({ node, messageId: 'prototypeMutation' });
        }
      },

      // ─── Global assignment ────────────────────────────────────────────
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        if (!checkGlobalAssignment) return;
        if (!isModuleScope(node)) return;

        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'Identifier' &&
          GLOBAL_OBJECTS.has(node.left.object.name)
        ) {
          context.report({ node, messageId: 'globalAssignment' });
        }
      },

      // ─── CJS patterns: require() ─────────────────────────────────────
      'CallExpression[callee.name="require"]'(node: TSESTree.CallExpression) {
        if (!checkCjsPatterns) return;
        if (!isModuleScope(node)) return;
        context.report({ node, messageId: 'cjsPatterns' });
      },

      // ─── CJS patterns: module.exports ─────────────────────────────────
      'MemberExpression[object.name="module"][property.name="exports"]'(
        node: TSESTree.MemberExpression,
      ) {
        if (!checkCjsPatterns) return;
        if (!isModuleScope(node)) return;
        context.report({ node, messageId: 'cjsPatterns' });
      },

      // ─── CJS patterns: exports.foo ────────────────────────────────────
      'MemberExpression[object.name="exports"]'(node: TSESTree.MemberExpression) {
        if (!checkCjsPatterns) return;
        if (!isModuleScope(node)) return;
        // Avoid double-reporting module.exports
        if (node.parent?.type === 'MemberExpression' && node.parent.object === node) {
          return;
        }
        context.report({ node, messageId: 'cjsPatterns' });
      },
    };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/no-treeshake-hazard.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Fix any failing tests and iterate**

Some tests may need adjustment due to how ESLint RuleTester works with TypeScript AST nodes and the parent traversal. Debug and fix.

- [ ] **Step 6: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.test.ts
git commit -m "feat(eslint-plugin-treeshake): implement no-treeshake-hazard rule with static checks"
```

---

### Task 7: Bundle check integration

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/lib/bundle-check.ts`
- Create: `packages/eslint-plugin-treeshake/src/lib/bundle-check.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/eslint-plugin-treeshake/src/lib/bundle-check.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { loadTreeshakeCheck, mapResultToFileReports, deduplicateReports } from './bundle-check.js';
import type { HazardCategory } from './explanations.js';

describe('mapResultToFileReports', () => {
  it('maps a HasSideEffects result to file-level reports', () => {
    const result = {
      _tag: 'HasSideEffects' as const,
      totalOriginalBytes: 1000,
      totalRenderedBytes: 500,
      modules: [
        {
          id: '/src/foo.ts',
          originalLength: 500,
          renderedLength: 250,
          shakingRatio: 0.5,
          renderedExports: ['foo'],
          removedExports: ['bar'],
          survivingCode: 'Object.defineProperty(exports, "__esModule", { value: true });',
          suspectedCauses: ['CommonJsContamination' as const],
        },
      ],
      warnings: [],
      hints: {
        hasSideEffectsField: false,
        hasModuleField: true,
        hasTypeModule: true,
        recommendations: [],
      },
      unshakenCode: '',
    };

    const reports = mapResultToFileReports(result);
    expect(reports).toHaveLength(1);
    expect(reports[0].filePath).toBe('/src/foo.ts');
    expect(reports[0].causes).toContain('CjsPatterns');
  });

  it('returns empty array for FullyTreeshakeable result', () => {
    const result = {
      _tag: 'FullyTreeshakeable' as const,
      hints: {
        hasSideEffectsField: true,
        hasModuleField: true,
        hasTypeModule: true,
        recommendations: [],
      },
    };
    const reports = mapResultToFileReports(result);
    expect(reports).toHaveLength(0);
  });
});

describe('deduplicateReports', () => {
  it('removes bundle findings already covered by static checks', () => {
    const staticFindings = new Map<string, Set<HazardCategory>>([
      ['/src/foo.ts', new Set(['EnumPattern'])],
    ]);
    const bundleReports = [
      {
        filePath: '/src/foo.ts',
        causes: ['EnumPattern' as HazardCategory],
        survivingCode: 'enum code',
        line: 1,
        column: 0,
      },
      {
        filePath: '/src/foo.ts',
        causes: ['CjsPatterns' as HazardCategory],
        survivingCode: 'require code',
        line: 5,
        column: 0,
      },
      {
        filePath: '/src/bar.ts',
        causes: ['GlobalAssignment' as HazardCategory],
        survivingCode: 'window.x',
        line: 1,
        column: 0,
      },
    ];

    const result = deduplicateReports(bundleReports, staticFindings);
    expect(result).toHaveLength(2);
    expect(result[0].filePath).toBe('/src/foo.ts');
    expect(result[0].causes).toEqual(['CjsPatterns']);
    expect(result[1].filePath).toBe('/src/bar.ts');
  });

  it('keeps all reports when no static findings exist', () => {
    const staticFindings = new Map<string, Set<HazardCategory>>();
    const bundleReports = [
      {
        filePath: '/src/foo.ts',
        causes: ['EnumPattern' as HazardCategory],
        survivingCode: 'code',
        line: 1,
        column: 0,
      },
    ];
    const result = deduplicateReports(bundleReports, staticFindings);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/bundle-check.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/eslint-plugin-treeshake/src/lib/bundle-check.ts`:

```ts
import type { HazardCategory } from './explanations.js';
import { findSnippetLocation } from './snippet-match.js';

export interface BundleFileReport {
  readonly filePath: string;
  readonly causes: ReadonlyArray<HazardCategory>;
  readonly survivingCode: string | null;
  readonly line: number;
  readonly column: number;
}

// Map treeshake-check's SuspectedCause to our HazardCategory
const mapCause = (cause: string): HazardCategory => {
  switch (cause) {
    case 'EnumPattern':
      return 'EnumPattern';
    case 'CommonJsContamination':
      return 'CjsPatterns';
    case 'PrototypeMutation':
      return 'PrototypeMutation';
    case 'GlobalAssignment':
      return 'GlobalAssignment';
    case 'UnannotatedCall':
      return 'UnannotatedCall';
    case 'TopLevelSideEffect':
      return 'TopLevelSideEffect';
    default:
      return 'Unknown';
  }
};

/**
 * Dynamically load @wolfcola/treeshake-check. Throws a clear error if
 * the package is not installed.
 */
export const loadTreeshakeCheck = async (): Promise<{
  checkPackage: (cwd?: string) => any;
}> => {
  try {
    return await import('@wolfcola/treeshake-check');
  } catch {
    throw new Error(
      'bundleCheck requires @wolfcola/treeshake-check to be installed. ' +
        'Run: pnpm add -D @wolfcola/treeshake-check',
    );
  }
};

/**
 * Map a treeshake-check result into per-file reports with source locations.
 */
export const mapResultToFileReports = (
  result: any,
  sourceContents?: Map<string, string>,
): BundleFileReport[] => {
  if (result._tag === 'FullyTreeshakeable') return [];

  return result.modules.map((mod: any): BundleFileReport => {
    const causes = (mod.suspectedCauses as string[]).map(mapCause);

    // Try to find source location via snippet matching
    let line = 1;
    let column = 0;
    if (mod.survivingCode && sourceContents?.has(mod.id)) {
      const loc = findSnippetLocation(sourceContents.get(mod.id)!, mod.survivingCode);
      if (loc) {
        line = loc.line;
        column = loc.column;
      }
    }

    return {
      filePath: mod.id,
      causes,
      survivingCode: mod.survivingCode ?? null,
      line,
      column,
    };
  });
};

/**
 * Remove bundle-check findings that duplicate what the static checks
 * already reported. Dedup key is (filePath, causeCategory).
 */
export const deduplicateReports = (
  bundleReports: BundleFileReport[],
  staticFindings: Map<string, Set<HazardCategory>>,
): BundleFileReport[] =>
  bundleReports
    .map((report) => {
      const staticCauses = staticFindings.get(report.filePath);
      if (!staticCauses) return report;

      const remaining = report.causes.filter((c) => !staticCauses.has(c));
      if (remaining.length === 0) return null;

      return { ...report, causes: remaining };
    })
    .filter((r): r is BundleFileReport => r !== null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/bundle-check.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/bundle-check.ts packages/eslint-plugin-treeshake/src/lib/bundle-check.test.ts
git commit -m "feat(eslint-plugin-treeshake): add bundle-check integration"
```

---

### Task 8: Wire bundle check into the rule

**Files:**

- Modify: `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts`
- Add tests to: `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.test.ts`

This task adds the `Program:exit` listener that runs the Rollup-based bundle check when `bundleCheck: true`, deduplicates against static findings, and reports additional diagnostics.

- [ ] **Step 1: Add bundle-check wiring to the rule's `create` function**

Add the following to the end of the `return { ... }` object in `no-treeshake-hazard.ts`, after the existing visitors. Also add the necessary imports and tracking state.

At the top of `create()`, add tracking for static findings:

```ts
// Track static findings per file for dedup with bundle check
const staticFindings = new Map<string, Set<HazardCategory>>();
const recordStaticFinding = (filePath: string, category: HazardCategory) => {
  if (!staticFindings.has(filePath)) {
    staticFindings.set(filePath, new Set());
  }
  staticFindings.get(filePath)!.add(category);
};
```

Add `recordStaticFinding` calls to each existing `context.report()` call, using the current filename from `context.filename`.

Then add this visitor at the end:

```ts
'Program:exit': async function (node: TSESTree.Program) {
  if (!options.bundleCheck) return;

  // Only run once per lint session — use a module-level flag
  if (bundleCheckRan) return;
  bundleCheckRan = true;

  try {
    const { checkPackage } = await loadTreeshakeCheck();
    const { Effect } = await import('effect');
    const { NodeContext } = await import('@effect/platform-node');

    const cwd = options.bundleCheckCwd ?? process.cwd();
    const result = await Effect.runPromise(
      checkPackage(cwd).pipe(Effect.provide(NodeContext.layer)),
    );

    const reports = mapResultToFileReports(result);
    const deduplicated = deduplicateReports(reports, staticFindings);

    for (const report of deduplicated) {
      // Only report if this file is the one currently being processed
      const currentFile = context.filename;
      if (report.filePath !== currentFile) continue;

      for (const cause of report.causes) {
        const explanation = EXPLANATIONS[cause];
        context.report({
          node,
          loc: { line: report.line, column: report.column },
          messageId: explanation.messageId as MessageIds,
        });
      }
    }
  } catch (error: unknown) {
    // Report the error as a lint diagnostic so it's visible
    context.report({
      node,
      messageId: 'unknown',
      data: { message: error instanceof Error ? error.message : String(error) },
    });
  }
},
```

Add at the module level (outside `create`):

```ts
import { loadTreeshakeCheck, mapResultToFileReports, deduplicateReports } from './bundle-check.js';
import type { HazardCategory } from './explanations.js';

let bundleCheckRan = false;
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run src/lib/no-treeshake-hazard.test.ts`
Expected: All existing tests still PASS

- [ ] **Step 3: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts
git commit -m "feat(eslint-plugin-treeshake): wire bundle-check into the rule"
```

---

### Task 9: Plugin entry point and preset configs

**Files:**

- Create: `packages/eslint-plugin-treeshake/src/index.ts`

- [ ] **Step 1: Write the plugin entry**

Create `packages/eslint-plugin-treeshake/src/index.ts`:

```ts
import type { ESLint } from 'eslint';
import { rule as noTreeshakeHazard } from './lib/no-treeshake-hazard.js';

const plugin: ESLint.Plugin = {
  meta: {
    name: '@wolfcola/eslint-plugin-treeshake',
    version: '0.0.0',
  },
  rules: {
    'no-treeshake-hazard': noTreeshakeHazard as any,
  },
  configs: {},
};

// Build configs after plugin is defined so we can self-reference
const recommended: ESLint.ConfigData = {
  plugins: { wolfcola: plugin } as any,
  rules: {
    'wolfcola/no-treeshake-hazard': 'warn',
  },
};

const strict: ESLint.ConfigData = {
  plugins: { wolfcola: plugin } as any,
  rules: {
    'wolfcola/no-treeshake-hazard': ['error', { bundleCheck: true }],
  },
};

plugin.configs = { recommended, strict };

export default plugin;
export { noTreeshakeHazard };
```

- [ ] **Step 2: Verify the full build**

Run: `cd packages/eslint-plugin-treeshake && pnpm tsc -p tsconfig.lib.json`
Expected: Compiles successfully, `dist/` created

- [ ] **Step 3: Run all tests**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/index.ts
git commit -m "feat(eslint-plugin-treeshake): add plugin entry point and preset configs"
```

---

### Task 10: sideEffects field check

**Files:**

- Modify: `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts`
- Add tests to: `packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.test.ts`

This adds a check in the `Program` visitor that looks for the nearest `package.json` and warns if it's missing the `sideEffects` field.

- [ ] **Step 1: Add the test cases**

Add to `no-treeshake-hazard.test.ts`:

```ts
// ─── MissingSideEffectsField ──────────────────────────────────────────────────
// This check reads the nearest package.json. We test it by mocking fs.
// For RuleTester, we can test that the visitor exists and does not crash
// on a basic file. Integration testing of the actual package.json reading
// is better done in a separate integration test.
```

Note: The `MissingSideEffectsField` check reads the file system, which is tricky to unit test with RuleTester. We'll add it as a best-effort check that reads `package.json` relative to the file being linted and logs a warning. A full integration test is deferred to a follow-up if needed.

- [ ] **Step 2: Add the package.json check to the rule**

In `no-treeshake-hazard.ts`, add to the `Program` visitor:

```ts
Program(node: TSESTree.Program) {
  // Check nearest package.json for sideEffects field
  const fs = await import('node:fs');
  const path = await import('node:path');

  let dir = path.dirname(context.filename);
  let pkgJsonPath: string | null = null;

  // Walk up to find nearest package.json
  for (let i = 0; i < 20; i++) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      pkgJsonPath = candidate;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (pkgJsonPath) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.sideEffects === undefined) {
        context.report({
          node,
          loc: { line: 1, column: 0 },
          messageId: 'missingSideEffectsField',
        });
      }
    } catch {
      // Ignore parse errors in package.json
    }
  }
},
```

Note: Since this uses synchronous fs operations (which are fine in an ESLint rule — ESLint visitors are synchronous), we import `node:fs` and `node:path` at the top of the file.

- [ ] **Step 3: Run tests**

Run: `cd packages/eslint-plugin-treeshake && pnpm vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.ts packages/eslint-plugin-treeshake/src/lib/no-treeshake-hazard.test.ts
git commit -m "feat(eslint-plugin-treeshake): check for missing sideEffects field in package.json"
```

---

### Task 11: README

**Files:**

- Create: `packages/eslint-plugin-treeshake/README.md`

- [ ] **Step 1: Write the README**

Create `packages/eslint-plugin-treeshake/README.md`:

````md
# @wolfcola/eslint-plugin-treeshake

An ESLint plugin that flags code patterns known to break tree-shaking. Catches problems at authoring time so they don't reach production bundles.

Optionally integrates with [@wolfcola/treeshake-check](https://www.npmjs.com/package/@wolfcola/treeshake-check) for full Rollup-based bundle analysis mapped back to source locations.

## Installation

```bash
pnpm add -D @wolfcola/eslint-plugin-treeshake
```

For bundle-check mode (optional):

```bash
pnpm add -D @wolfcola/treeshake-check
```

## Setup

### Flat config (ESLint 9+)

```js
// eslint.config.mjs
import treeshake from '@wolfcola/eslint-plugin-treeshake';

export default [
  // Use the recommended preset (all static checks, warn severity)
  treeshake.configs.recommended,

  // Or configure manually:
  {
    plugins: { wolfcola: treeshake },
    rules: {
      'wolfcola/no-treeshake-hazard': [
        'warn',
        {
          checkEnums: true,
          checkUnannotatedCalls: true,
          checkPrototypeMutation: true,
          checkGlobalAssignment: true,
          checkCjsPatterns: true,
          additionalPureFunctions: [],
          bundleCheck: false,
        },
      ],
    },
  },
];
```

### Strict preset

Enables all static checks at `error` severity and turns on bundle-check mode:

```js
import treeshake from '@wolfcola/eslint-plugin-treeshake';

export default [treeshake.configs.strict];
```

## Rule: `wolfcola/no-treeshake-hazard`

A single rule covering all tree-shaking hazard categories.

### What it detects

| Hazard                    | What it flags                                                 | Autofix                       |
| ------------------------- | ------------------------------------------------------------- | ----------------------------- |
| `EnumPattern`             | TypeScript `enum` declarations at module scope                | Suggestion: `as const` object |
| `UnannotatedCall`         | Top-level function calls without `/*#__PURE__*/`              | Fix: inserts `/*#__PURE__*/`  |
| `PrototypeMutation`       | `Object.defineProperty`, `.prototype.x = ...` at module scope | None                          |
| `GlobalAssignment`        | `window.x = ...`, `globalThis.x = ...` at module scope        | None                          |
| `CjsPatterns`             | `require()`, `module.exports` in ESM files                    | None                          |
| `MissingSideEffectsField` | Missing `"sideEffects"` field in the nearest `package.json`   | None                          |

### Options

| Option                    | Type       | Default | Description                                  |
| ------------------------- | ---------- | ------- | -------------------------------------------- |
| `checkEnums`              | `boolean`  | `true`  | Flag TypeScript enums                        |
| `checkUnannotatedCalls`   | `boolean`  | `true`  | Flag top-level calls without `/*#__PURE__*/` |
| `checkPrototypeMutation`  | `boolean`  | `true`  | Flag prototype/property mutations            |
| `checkGlobalAssignment`   | `boolean`  | `true`  | Flag global object assignments               |
| `checkCjsPatterns`        | `boolean`  | `true`  | Flag CommonJS patterns in ESM                |
| `additionalPureFunctions` | `string[]` | `[]`    | Function names to treat as side-effect-free  |
| `bundleCheck`             | `boolean`  | `false` | Run full Rollup-based analysis (slow)        |
| `bundleCheckCwd`          | `string`   | auto    | Working directory for bundle check           |

### Known-pure functions (not flagged)

The following top-level calls are recognized as side-effect-free and not flagged by `checkUnannotatedCalls`:

`Object.freeze`, `Object.create`, `Object.keys`, `Object.values`, `Object.entries`, `Object.fromEntries`, `Symbol`, `Symbol.for`, `Array.from`, `Array.of`, `Array.isArray`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Number.isNaN`, `Number.isFinite`, `Number.parseInt`, `Number.parseFloat`, `String.fromCharCode`, `String.fromCodePoint`, `JSON.parse`, `JSON.stringify`, `Math.max`, `Math.min`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.abs`, `Promise.resolve`, `Promise.reject`

Extend with `additionalPureFunctions`.

### Bundle check mode

When `bundleCheck: true`, the rule runs a full Rollup build via `@wolfcola/treeshake-check` and maps results back to source locations. This is slow but catches issues that static analysis misses (transitive side effects, bundler-specific behavior).

Bundle-check findings are deduplicated against static findings — if both detect the same hazard category in the same file, only the static finding is reported.

Requires `@wolfcola/treeshake-check` as a dev dependency.

### Relationship to @wolfcola/treeshake-check

|                 | eslint-plugin-treeshake          | treeshake-check          |
| --------------- | -------------------------------- | ------------------------ |
| **When**        | Authoring time                   | Post-build / CI          |
| **Speed**       | Fast (per-file AST)              | Slow (full Rollup build) |
| **Accuracy**    | Heuristic                        | Ground truth             |
| **Integration** | Editor squiggles, `eslint --fix` | CLI, exit codes          |

Use both: the ESLint plugin for fast feedback during development, `treeshake-check` as a CI quality gate.

## Examples

### Before (flagged)

```ts
// Enum — breaks tree-shaking
export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// Unannotated call — bundler assumes side effects
const registry = createRegistry();

// Global assignment — observable side effect
window.MY_APP = { version: '1.0' };
```

### After (clean)

```ts
// as const object — fully shakeable
export const Direction = {
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

// PURE annotation — bundler can safely drop if unused
const registry = /*#__PURE__*/ createRegistry();

// Moved into an explicit init function
export function initApp() {
  window.MY_APP = { version: '1.0' };
}
```
````

- [ ] **Step 2: Commit**

```bash
git add packages/eslint-plugin-treeshake/README.md
git commit -m "docs(eslint-plugin-treeshake): add README"
```

---

### Task 12: Provenance and publish config

**Files:**

- Modify: `packages/eslint-plugin-treeshake/package.json`

- [ ] **Step 1: Verify provenance setup in existing packages**

Look at other packages' `publishConfig` and CI workflow to understand how provenance is configured. The existing packages use:

```json
"publishConfig": {
  "access": "public"
}
```

Provenance is typically configured at the CI/workflow level (e.g., `--provenance` flag on `npm publish` or `changesets publish`), not per-package. Ensure `publishConfig.access` is set (already done in Task 1).

- [ ] **Step 2: Verify the package is included in pnpm workspace**

The `pnpm-workspace.yaml` uses `packages: ['packages/*']`, which already matches `packages/eslint-plugin-treeshake`. No change needed.

- [ ] **Step 3: Final build and test**

Run:

```bash
cd packages/eslint-plugin-treeshake
pnpm build
pnpm test
pnpm lint
```

Expected: All pass

- [ ] **Step 4: Run typecheck from root**

Run: `pnpm typecheck`
Expected: Full project typecheck passes, including the new package

- [ ] **Step 5: Commit any final adjustments**

```bash
git add -A
git commit -m "chore(eslint-plugin-treeshake): finalize publish config and workspace integration"
```

---

## Summary

| Task | What                        | Commit message                                                                         |
| ---- | --------------------------- | -------------------------------------------------------------------------------------- |
| 1    | Package scaffolding         | `chore: scaffold eslint-plugin-treeshake package`                                      |
| 2    | Known-pure allowlist        | `feat(eslint-plugin-treeshake): add known-pure allowlist`                              |
| 3    | Explanations data           | `feat(eslint-plugin-treeshake): add hazard explanations`                               |
| 4    | Scope utilities             | `feat(eslint-plugin-treeshake): add scope utilities`                                   |
| 5    | Snippet matching            | `feat(eslint-plugin-treeshake): add snippet-match utility`                             |
| 6    | Rule static checks          | `feat(eslint-plugin-treeshake): implement no-treeshake-hazard rule with static checks` |
| 7    | Bundle check module         | `feat(eslint-plugin-treeshake): add bundle-check integration`                          |
| 8    | Wire bundle check into rule | `feat(eslint-plugin-treeshake): wire bundle-check into the rule`                       |
| 9    | Plugin entry + configs      | `feat(eslint-plugin-treeshake): add plugin entry point and preset configs`             |
| 10   | sideEffects field check     | `feat(eslint-plugin-treeshake): check for missing sideEffects field in package.json`   |
| 11   | README                      | `docs(eslint-plugin-treeshake): add README`                                            |
| 12   | Provenance + final checks   | `chore(eslint-plugin-treeshake): finalize publish config and workspace integration`    |
