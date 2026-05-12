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

// Disable sideEffects check in tests — the test package.json doesn't have sideEffects
const O = [{ checkSideEffectsField: false }] as const;

// ────────────────────────────────────────────
// 1. EnumPattern
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (enum)', noTreeshakeHazard, {
  valid: [
    { code: `const Direction = { Up: 0, Down: 1 } as const;`, options: O },
    { code: `function setup() { enum Direction { Up, Down } }`, options: O },
    {
      code: `enum Direction { Up, Down }`,
      options: [{ checkEnums: false, checkSideEffectsField: false }],
    },
  ],
  invalid: [
    {
      code: `export enum Direction { Up, Down }`,
      options: O,
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
      options: O,
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
      options: O,
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
    { code: `function setup() { initialize(); }`, options: O },
    { code: `const x = /*#__PURE__*/ createStore();`, options: O },
    { code: `const frozen = Object.freeze({});`, options: O },
    { code: `const sym = Symbol.for("key");`, options: O },
    {
      code: `const s = createStore();`,
      options: [{ additionalPureFunctions: ['createStore'], checkSideEffectsField: false }],
    },
    {
      code: `initialize();`,
      options: [{ checkUnannotatedCalls: false, checkSideEffectsField: false }],
    },
    { code: `import { foo } from 'bar';`, options: O },
    { code: `const x = 42;`, options: O },
  ],
  invalid: [
    {
      code: `initialize();`,
      options: O,
      output: `/*#__PURE__*/ initialize();`,
      errors: [{ messageId: 'unannotatedCall' }],
    },
    {
      code: `const store = createStore();`,
      options: O,
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
    {
      code: `function setup() { Object.defineProperty(obj, 'x', { value: 1 }); }`,
      options: O,
    },
    { code: `Object.keys({});`, options: O },
    {
      code: `Object.defineProperty(obj, 'x', { value: 1 });`,
      options: [{ checkPrototypeMutation: false, checkSideEffectsField: false }],
    },
  ],
  invalid: [
    {
      code: `Object.defineProperty(obj, 'x', { value: 1 });`,
      options: O,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Object.defineProperties(obj, { x: { value: 1 } });`,
      options: O,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Object.setPrototypeOf(obj, proto);`,
      options: O,
      errors: [{ messageId: 'prototypeMutation' }],
    },
    {
      code: `Foo.prototype.bar = function() {};`,
      options: O,
      errors: [{ messageId: 'prototypeMutation' }],
    },
  ],
});

// ────────────────────────────────────────────
// 4. GlobalAssignment
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (global assignment)', noTreeshakeHazard, {
  valid: [
    { code: `function setup() { window.x = 1; }`, options: O },
    { code: `const x = window.innerWidth;`, options: O },
    {
      code: `window.x = 1;`,
      options: [{ checkGlobalAssignment: false, checkSideEffectsField: false }],
    },
  ],
  invalid: [
    { code: `window.x = 1;`, options: O, errors: [{ messageId: 'globalAssignment' }] },
    { code: `globalThis.x = 1;`, options: O, errors: [{ messageId: 'globalAssignment' }] },
    { code: `self.x = 1;`, options: O, errors: [{ messageId: 'globalAssignment' }] },
    { code: `global.x = 1;`, options: O, errors: [{ messageId: 'globalAssignment' }] },
  ],
});

// ────────────────────────────────────────────
// 5. CjsPatterns
// ────────────────────────────────────────────
tester.run('no-treeshake-hazard (cjs patterns)', noTreeshakeHazard, {
  valid: [
    { code: `import fs from 'fs';`, options: O },
    { code: `function load() { require('fs'); }`, options: O },
    {
      code: `require('fs');`,
      options: [{ checkCjsPatterns: false, checkSideEffectsField: false }],
    },
  ],
  invalid: [
    { code: `require('fs');`, options: O, errors: [{ messageId: 'cjsPatterns' }] },
    { code: `module.exports = {};`, options: O, errors: [{ messageId: 'cjsPatterns' }] },
    { code: `exports.foo = bar;`, options: O, errors: [{ messageId: 'cjsPatterns' }] },
  ],
});
