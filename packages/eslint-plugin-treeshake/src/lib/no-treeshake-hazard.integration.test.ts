import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';
import plugin from '../index.js';

const createLinter = (ruleOptions: Record<string, unknown> = {}) => {
  const linter = new Linter();
  const config = {
    plugins: { wolfcola: plugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: { projectService: false },
    },
    rules: {
      'wolfcola/no-treeshake-hazard': [
        'error' as const,
        { checkSideEffectsField: false, ...ruleOptions },
      ],
    },
  };
  return {
    lint: (code: string) => linter.verify(code, config),
    fix: (code: string) => linter.verifyAndFix(code, config),
  };
};

describe('no-treeshake-hazard integration', () => {
  it('detects multiple hazard types in a single file', () => {
    const { lint } = createLinter();
    const code = [
      'export enum Status { Active, Inactive }',
      '',
      'const registry = createRegistry();',
      '',
      'window.MY_APP = { version: "1.0" };',
    ].join('\n');

    const errors = lint(code);
    const messageIds = errors.map((e) => e.messageId);

    expect(messageIds).toContain('enumPattern');
    expect(messageIds).toContain('unannotatedCall');
    expect(messageIds).toContain('globalAssignment');
    expect(errors.length).toBe(3);
  });

  it('recommended config loads and reports warnings', () => {
    const linter = new Linter();
    const errors = linter.verify('export enum Dir { Up }', {
      ...plugin.configs!.recommended,
      languageOptions: {
        parser: tsParser,
        parserOptions: { projectService: false },
      },
    });

    const messageIds = errors.map((e) => e.messageId);
    expect(messageIds).toContain('enumPattern');
    // recommended config uses severity 1 (warn)
    const enumError = errors.find((e) => e.messageId === 'enumPattern')!;
    expect(enumError.severity).toBe(1);
  });

  it('autofix inserts /*#__PURE__*/ annotation on unannotated calls', () => {
    const { fix } = createLinter();
    const code = ['const a = createStore();', 'const b = initRegistry();', 'export { a, b };'].join(
      '\n',
    );

    const result = fix(code);
    expect(result.output).toContain('/*#__PURE__*/ createStore()');
    expect(result.output).toContain('/*#__PURE__*/ initRegistry()');
    expect(result.fixed).toBe(true);
  });

  it('reports missing sideEffects field when checkSideEffectsField is enabled', () => {
    // The test package.json does not have sideEffects, so this should fire
    const { lint } = createLinter({ checkSideEffectsField: true });
    const code = 'export const x = 1;';

    const errors = lint(code);
    const messageIds = errors.map((e) => e.messageId);
    expect(messageIds).toContain('missingSideEffectsField');
  });

  it('reports no errors on a clean, tree-shakeable file', () => {
    const { lint } = createLinter();
    const code = [
      'export const Direction = {',
      '  Up: "UP",',
      '  Down: "DOWN",',
      '} as const;',
      'export type Direction = (typeof Direction)[keyof typeof Direction];',
      '',
      'const registry = /*#__PURE__*/ createRegistry();',
      '',
      'export function getDirection(): Direction {',
      '  return Direction.Up;',
      '}',
      '',
      'export { registry };',
    ].join('\n');

    const errors = lint(code);
    expect(errors).toHaveLength(0);
  });

  it('ignores hazard patterns inside functions and classes', () => {
    const { lint } = createLinter();
    const code = [
      'export function setup() {',
      '  enum InternalStatus { On, Off }',
      '  const store = createStore();',
      '  window.debug = { store };',
      '  Object.defineProperty(store, "id", { value: 1 });',
      '  return { store };',
      '}',
    ].join('\n');

    const errors = lint(code);
    expect(errors).toHaveLength(0);
  });
});
