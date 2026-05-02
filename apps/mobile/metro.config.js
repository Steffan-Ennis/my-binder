// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname)

// Exclude Jest test/spec files from the Metro bundle. Without this, Expo Router's
// `require.context('./app', true, /.*/)` registers `*.test.tsx` files as routes
// and Metro tries to bundle `@testing-library/react-native`, which imports the
// Node stdlib `console` module and crashes the native runtime.
const existingBlockList = config.resolver.blockList;
const testFilePatterns = [
  /.*\.test\.[jt]sx?$/,
  /.*\.spec\.[jt]sx?$/,
  /.*\/__tests__\/.*/,
  /.*\/__mocks__\/.*/,
];

config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, ...testFilePatterns]
  : existingBlockList
    ? [existingBlockList, ...testFilePatterns]
    : testFilePatterns;

module.exports = config;
