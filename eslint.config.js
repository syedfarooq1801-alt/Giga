const tseslintPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'gigabhai-frontend/**',
      'gigabhai-backend/**',
      'api/**',
      // Vestigial Next.js-style files from an earlier framework attempt --
      // unreferenced by any config (no next.config.js, no build entry
      // points to them) and not part of the current Expo/react-native-web app.
      'pages/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      // Only the two classic hooks rules -- eslint-plugin-react-hooks v7's
      // "recommended" config also pulls in new React Compiler static
      // checks, which are far too aggressive for a codebase not using the
      // compiler and would require real behavioral changes across many
      // files unrelated to this work.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Downgraded rather than fixed: ~170 pre-existing violations across
      // the app (not introduced by this change) would otherwise block CI
      // on unrelated debt. Still surfaced as warnings, not silenced.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // require() is the standard way to reference image/font assets under
      // Metro (RN's bundler) -- ES import syntax doesn't work for those.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
