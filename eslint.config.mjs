import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.output/**',
      '**/.vinxi/**',
      '**/.nitro/**',
      '**/.turbo/**',
      '**/.vercel/**',
      '**/.mf/**',
      '**/@mf-types/**',
      '**/node_modules/**',
      '**/routeTree.gen.ts',
      '**/*.gen.ts',
      'apps/*/public/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript / React source
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Plain JS / config scripts (Node)
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Turn off rules that conflict with Prettier (keep last)
  prettier,
);
