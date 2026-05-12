import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import eslintPluginImport from 'eslint-plugin-import';
import typescriptEslintParser from '@typescript-eslint/parser';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/coverage',
      '**/elm-stuff',
      '**/vite.config.*.timestamp*',
      '**/__fixtures__/**',
      '**/out-tsc/**',
      '**/.elm-pages/**',
      '**/functions/**',
      '**/codegen/**',
      'packages/docs-site/**',
    ],
  },
  ...compat.extends('plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'),
  {
    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
      import: eslintPluginImport,
    },
  },
  {
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
      },
    },
  },
  {
    rules: {
      'import/extensions': [2, 'ignorePackages'],
      'require-yield': 'off',
      '@typescript-eslint/no-use-before-define': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'max-len': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'import/extensions': [2, 'ignorePackages'],
    },
  },
];
