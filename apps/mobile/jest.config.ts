import type { Config } from 'jest';

// Canonical Expo SDK 54 unit-testing setup per https://docs.expo.dev/develop/unit-testing/.
// jest-expo provides:
//   - testEnvironment: 'node'
//   - babel-jest with babel-preset-expo (handles TS + JSX + Flow)
//   - default mocks for the common Expo modules
// We layer on:
//   - the constitution's coverage thresholds (80% global, 90/95% on the load-bearing hooks)
//   - module-name aliases that mirror tsconfig.json
//   - a transformIgnorePatterns whitelist (per the Expo docs) so Babel transforms
//     ESM-only packages (e.g., expo-router, @react-native, etc.) before Jest runs them
//   - jest.setup.ts to register matchers and mock the modules our tests touch directly
const config: Config = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
  moduleNameMapper: {
    '^@root/(.*)$': '<rootDir>/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    // Short-circuit Expo's winter (import.meta / WHATWG) polyfills — see
    // apps/mobile/__mocks__/expoWinterStub.js for the rationale.
    '^expo/src/winter$': '<rootDir>/__mocks__/expoWinterStub.js',
    '^expo/src/winter/runtime$': '<rootDir>/__mocks__/expoWinterStub.js',
    '^expo/src/winter/runtime\\.native$': '<rootDir>/__mocks__/expoWinterStub.js',
  },
  // Mirrors the official Expo recommendation, with `\\.pnpm` added so packages hoisted
  // under `node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>` (the pnpm layout)
  // also get transformed by babel-jest. Without this, RN/Expo ESM files that ship
  // under `.pnpm/` reach Jest unparsed and fail with "Cannot use import statement".
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Spec 017 — per-feature 90% floor for the reusable Card slice + its hook
    // (load-bearing component reused across screens; regressions in its state
    // machine silently break every consumer).
    './src/components/card/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/hooks/useCardImagesQuery.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Spec 018 — shared masthead is consumed by Binder + Catalogue; a
    // regression silently breaks two screens at once, so we hold it to 90%.
    './src/components/masthead/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/components/catalogue/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/components/catalogue-filter-sheet/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/components/card-detail-sheet/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Optimistic-mutation rollback path is the SC-011 / SC-012 safety net.
    './src/hooks/useUpdateBinderEntryMutation.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

export default config;
