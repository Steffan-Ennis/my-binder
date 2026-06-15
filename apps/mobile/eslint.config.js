// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      // Nested ternaries are unreadable — use if-ladders or lookups instead.
      'no-nested-ternary': 'error',
      // Allow both `Array<T>`/`ReadonlyArray<T>` and `T[]`/`readonly T[]`.
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*'],
  },
]);
