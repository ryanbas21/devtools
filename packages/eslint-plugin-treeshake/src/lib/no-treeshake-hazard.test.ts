import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it, afterAll } from 'vitest';
import { noTreeshakeHazard } from './no-treeshake-hazard.js';

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

// ────────────────────────────────────────────
// 1. EnumPattern
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (enum)', noTreeshakeHazard, {
  valid: [
    // as const object is fine
    {
      code: `const Direction = { Up: 0, Down: 1 } as const;`,
    },
    // enum inside a function is fine
    {
      code: `function setup() { enum Direction { Up, Down } }`,
    },
    // disabled via option
    {
      code: `enum Direction { Up, Down }`,
      options: [{ checkEnums: false }],
    },
  ],
  invalid: [
    {
      code: `export enum Direction { Up, Down }`,
      errors: [
        {
          messageId: 'enumPattern',
          suggestions: [
            {
              messageId: 'enumSuggestion',
              output: `export const Direction = {\n  Up: "Up",\n  Down: "Down",\n} as const;\nexport type Direction = (typeof Direction)[keyof typeof Direction];`,
            },
          ],
        },
      ],
    },
    {
      code: `enum Status { Active = "ACTIVE", Inactive = "INACTIVE" }`,
      errors: [
        {
          messageId: 'enumPattern',
          suggestions: [
            {
              messageId: 'enumSuggestion',
              output: `const Status = {\n  Active: "ACTIVE",\n  Inactive: "INACTIVE",\n} as const;\ntype Status = (typeof Status)[keyof typeof Status];`,
            },
          ],
        },
      ],
    },
    {
      code: `const enum Flags { A, B }`,
      errors: [
        {
          messageId: 'enumPattern',
          suggestions: [
            {
              messageId: 'enumSuggestion',
              output: `const Flags = {\n  A: "A",\n  B: "B",\n} as const;\ntype Flags = (typeof Flags)[keyof typeof Flags];`,
            },
          ],
        },
      ],
    },
  ],
});

// ────────────────────────────────────────────
// 2. UnannotatedCall
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (unannotated call)', noTreeshakeHazard, {
  valid: [
    // inside a function
    { code: `function setup() { initialize(); }` },
    // annotated
    { code: `const x = /*#__PURE__*/ createStore();` },
    // known pure
    { code: `const frozen = Object.freeze({});` },
    { code: `const sym = Symbol.for("key");` },
    // additional pure
    {
      code: `const s = createStore();`,
      options: [{ additionalPureFunctions: ['createStore'] }],
    },
    // disabled
    {
      code: `initialize();`,
      options: [{ checkUnannotatedCalls: false }],
    },
    // import statement (not a call)
    { code: `import { foo } from 'bar';` },
    // plain variable
    { code: `const x = 42;` },
  ],
  invalid: [
    {
      code: `initialize();`,
      output: `/*#__PURE__*/ initialize();`,
      errors: [{ messageId: 'unannotatedCall' }],
    },
    {
      code: `const store = createStore();`,
      output: `const store = /*#__PURE__*/ createStore();`,
      errors: [{ messageId: 'unannotatedCall' }],
    },
  ],
});

// ────────────────────────────────────────────
// 3. PrototypeMutation
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (prototype mutation)', noTreeshakeHazard, {
  valid: [
    // inside a function
    {
      code: `function setup() { Object.defineProperty(obj, 'x', { value: 1 }); }`,
    },
    // Object.keys is not a mutation method
    { code: `Object.keys({});` },
    // disabled
    {
      code: `Object.defineProperty(obj, 'x', { value: 1 });`,
      options: [{ checkPrototypeMutation: false }],
    },
  ],
  invalid: [
    {
      code: `Object.defineProperty(obj, 'x', { value: 1 });`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Object.defineProperties(obj, { x: { value: 1 } });`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Object.setPrototypeOf(obj, proto);`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Foo.prototype.bar = function() {};`,
      errors: [{ messageId: 'prototypeMutation' }],
    },
  ],
});

// ────────────────────────────────────────────
// 4. GlobalAssignment
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (global assignment)', noTreeshakeHazard, {
  valid: [
    // inside a function
    { code: `function setup() { window.x = 1; }` },
    // reading from global (not assignment)
    { code: `const x = window.innerWidth;` },
    // disabled
    {
      code: `window.x = 1;`,
      options: [{ checkGlobalAssignment: false }],
    },
  ],
  invalid: [
    {
      code: `window.x = 1;`,
      errors: [{ messageId: 'globalAssignment' }],
    },
    {
      code: `globalThis.x = 1;`,
      errors: [{ messageId: 'globalAssignment' }],
    },
    {
      code: `self.x = 1;`,
      errors: [{ messageId: 'globalAssignment' }],
    },
    {
      code: `global.x = 1;`,
      errors: [{ messageId: 'globalAssignment' }],
    },
  ],
});

// ────────────────────────────────────────────
// 5. CjsPatterns
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (cjs patterns)', noTreeshakeHazard, {
  valid: [
    // ESM import
    { code: `import fs from 'fs';` },
    // inside a function
    { code: `function load() { require('fs'); }` },
    // disabled
    {
      code: `require('fs');`,
      options: [{ checkCjsPatterns: false }],
    },
  ],
  invalid: [
    {
      code: `require('fs');`,
      errors: [{ messageId: 'cjsPatterns' }],
    },
    {
      code: `module.exports = {};`,
      errors: [{ messageId: 'cjsPatterns' }],
    },
    {
      code: `exports.foo = bar;`,
      errors: [{ messageId: 'cjsPatterns' }],
    },
  ],
});
