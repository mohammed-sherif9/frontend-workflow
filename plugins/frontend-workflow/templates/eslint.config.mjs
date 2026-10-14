// Strict ESLint flat config for Next.js 16+ / React / TypeScript (frontend-workflow template).
// Install: see dev-dependencies.md
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  // Next.js + React + React Hooks + Core Web Vitals rules
  ...nextVitals,

  // Strict, type-aware TypeScript rules
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // Explicit return types on exported non-component code (services, utils, hooks)
  { files: ['**/*.{ts,mts,cts}'], rules: { '@typescript-eslint/explicit-module-boundary-types': 'error' } },

  // Accessibility. eslint-config-next already registers the jsx-a11y plugin,
  // so only the recommended rules are added here.
  { files: ['**/*.{jsx,tsx}'], rules: { ...jsxA11y.flatConfigs.recommended.rules } },

  // React rules (the react plugin is registered by eslint-config-next for JSX files)
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      'react/jsx-no-useless-fragment': 'error',
      'react/self-closing-comp': 'error',
      'react/no-array-index-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-danger': 'error',
    },
  },

  // Security
  security.configs.recommended,
  { rules: { 'security/detect-object-injection': 'off' } }, // too noisy for typed TS code

  // Clean-code rules
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
      'no-nested-ternary': 'error',
      'prefer-const': 'error',
      'no-param-reassign': 'error',
      complexity: ['error', 12],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      // Architecture: features are imported only through their public index.ts
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*', '**/features/*/*'],
              message: 'Import a feature only through its public API (features/<name>/index.ts).',
            },
          ],
        },
      ],
    },
  },

  // Inside a feature, relative imports of its own internals are fine.
  {
    files: ['src/features/**'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Tests: allow test-only patterns
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**', 'e2e/**', '**/test-utils.*'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'max-lines': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // Plain JS config files are not type-checked
  { files: ['**/*.{js,mjs,cjs}'], extends: [tseslint.configs.disableTypeChecked] },

  // Must stay last: turns off rules that fight Prettier
  prettier,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts', 'playwright-report/**']),
]);
