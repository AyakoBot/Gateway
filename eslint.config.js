/* eslint-disable @typescript-eslint/naming-convention */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
 {
  ignores: ['dist/**', 'node_modules/**', '**/*.js', '!eslint.config.js'],
 },
 js.configs.recommended,
 tseslint.configs.recommended,
 prettier,
 {
  languageOptions: {
   parser: tseslint.parser,
   parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    tsconfigRootDir: dir,
   },
   globals: { ...globals.node },
  },
  plugins: {
   import: importPlugin,
  },
  settings: {
   'import/resolver': {
    node: {
     extensions: ['.js', '.mjs', '.cjs'],
    },
   },
  },
  rules: {
   // typescript-eslint strongly recommend that you do not use the no-undef lint rule on
   // TypeScript projects. See: https://typescript-eslint.io/troubleshooting/faqs/eslint/
   'no-undef': 'off',

   // Airbnb-style rules
   'prefer-const': 'error',
   'no-var': 'error',
   'object-shorthand': 'error',
   'quote-props': ['error', 'as-needed'],
   'prefer-template': 'error',
   'template-curly-spacing': 'error',
   'prefer-arrow-callback': 'error',
   'arrow-spacing': 'error',
   'arrow-parens': ['error', 'always'],
   'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
   'no-confusing-arrow': 'error',
   'implicit-arrow-linebreak': 'off',
   'func-style': ['error', 'expression'],
   'prefer-destructuring': [
    'error',
    {
     array: true,
     object: true,
    },
   ],
   quotes: ['error', 'single', { avoidEscape: true }],
   'max-len': [
    'error',
    100,
    2,
    {
     ignoreUrls: true,
     ignoreComments: false,
     ignoreRegExpLiterals: true,
     ignoreStrings: true,
     ignoreTemplateLiterals: true,
    },
   ],
   'comma-style': ['error', 'last'],
   'comma-dangle': ['error', 'always-multiline'],
   indent: 'off', // Handled by Prettier
   'space-before-blocks': 'error',
   'keyword-spacing': 'error',
   'space-infix-ops': 'error',
   'padded-blocks': ['error', 'never'],
   'no-multiple-empty-lines': ['error', { max: 1 }],
   'array-bracket-spacing': ['error', 'never'],
   'object-curly-spacing': ['error', 'always'],
   'block-spacing': ['error', 'always'],
   'computed-property-spacing': ['error', 'never'],
   'key-spacing': ['error', { beforeColon: false, afterColon: true }],
   'no-trailing-spaces': 'error',
   'no-mixed-spaces-and-tabs': 'error',
   eqeqeq: ['error', 'always'],
   'brace-style': ['error', '1tbs', { allowSingleLine: true }],
   camelcase: ['error', { properties: 'never' }],
   'new-cap': [
    'error',
    {
     newIsCap: true,
     capIsNew: false,
    },
   ],
   'no-underscore-dangle': [
    'error',
    {
     allowAfterThis: true,
     enforceInMethodNames: false,
     allow: ['_'],
    },
   ],
   semi: ['error', 'always'],
   'semi-spacing': ['error', { before: false, after: true }],
   'no-new-wrappers': 'error',
   radix: 'error',
   'id-length': [
    'error',
    {
     min: 1,
     exceptions: ['i', 'j', 'x', 'y', 'z', '_'],
    },
   ],
   'no-restricted-syntax': [
    'error',
    {
     selector: 'ForInStatement',
     message:
      'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    },
    {
     selector: 'LabeledStatement',
     message:
      'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    },
    {
     selector: 'WithStatement',
     message:
      '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    },
   ],
   'no-constructor-return': 'error',
   'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
   'prefer-exponentiation-operator': 'error',
   'no-restricted-properties': [
    'error',
    {
     object: 'Math',
     property: 'pow',
     message: 'Use the exponentiation operator (**) instead.',
    },
   ],

   // Import rules
   'import/first': 'error',
   'import/no-mutable-exports': 'error',
   'import/prefer-default-export': 'off',
   'no-restricted-imports': [
    'error',
    {
     patterns: [
      {
       group: ['src/*', 'src/**'],
       message: 'Use relative imports instead of src/ paths.',
      },
     ],
    },
   ],
   'import/order': [
    'error',
    {
     groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
     'newlines-between': 'always',
     alphabetize: {
      order: 'asc',
      caseInsensitive: true,
     },
    },
   ],
   'import/newline-after-import': 'error',
   'import/extensions': [
    'error',
    'ignorePackages',
    {
     js: 'always',
     mjs: 'always',
     ts: 'always',
     tsx: 'always',
    },
   ],

   // TypeScript specific overrides
   '@typescript-eslint/no-this-alias': 'off',
   '@typescript-eslint/explicit-function-return-type': 'off',
   '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false }],
   '@typescript-eslint/no-unused-vars': [
    'error',
    {
     argsIgnorePattern: '^_',
     varsIgnorePattern: '^_',
    },
   ],
   'no-unused-vars': 'off',
   '@typescript-eslint/naming-convention': [
    'warn',
    {
     selector: 'default',
     format: ['camelCase'],
    },
    {
     selector: 'variable',
     format: ['camelCase', 'UPPER_CASE'],
    },
    {
     selector: 'parameter',
     format: ['camelCase'],
     leadingUnderscore: 'allow',
    },
    {
     selector: 'typeLike',
     format: ['PascalCase'],
    },
    {
     selector: 'enumMember',
     format: ['PascalCase'],
    },
    {
     selector: 'import',
     format: ['camelCase', 'PascalCase'],
    },
    {
     selector: 'method',
     format: ['camelCase'],
     leadingUnderscore: 'allow',
     modifiers: ['private'],
    },
    {
     selector: 'objectLiteralProperty',
     format: null,
     filter: {
      regex: '^[A-Z].*-.*',
      match: true,
     },
    },
    {
     selector: 'objectLiteralProperty',
     format: null,
     filter: {
      regex: '^\\d+$',
      match: true,
     },
    },
    {
     selector: 'objectLiteralProperty',
     format: null,
     filter: {
      regex: '^\\w+_\\w+$',
      match: true,
     },
    },
    {
     selector: 'objectLiteralProperty',
     format: ['camelCase'],
    },
    {
     selector: 'objectLiteralMethod',
     format: null,
     filter: {
      regex: '^CallExpression$',
      match: true,
     },
    },
   ],
   '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

   // Other overrides
   curly: ['error', 'multi-line', 'consistent'],
   'no-else-return': 'error',
   'no-console': 'warn',
   'no-debugger': 'error',
  },
 },
);