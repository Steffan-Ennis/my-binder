import '@testing-library/react-native/matchers';

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signOut: jest.fn(),
    revokeAccess: jest.fn(),
    getCurrentUser: jest.fn(() => null),
    getTokens: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBaseUrl: 'https://test.example.com',
      googleIosClientId: 'ios.test',
      googleAndroidClientId: 'android.test',
      googleWebClientId: 'web.test',
    },
  },
}));

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: View };
});

// Spec 020 — the 30-day price-trend chart (`react-native-gifted-charts`) is
// deferred; the dependency was removed, so there is no chart mock here. The
// price-history data layer (query + `priceSeriesToChartData`) is retained.

jest.mock('react-native-pager-view', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // Render only the page at `initialPage` (default 0). Real PagerView mounts
  // its neighbours via `offscreenPageLimit`; for unit tests we keep the tree
  // tight so test queries reflect the visible page only.
  const PagerView = ({
    children,
    initialPage = 0,
    testID,
    style,
  }: {
    children?: React.ReactNode;
    initialPage?: number;
    testID?: string;
    style?: unknown;
  }) => {
    const pages = React.Children.toArray(children);
    const visible = pages[initialPage] ?? null;
    return React.createElement(View, { testID, style }, visible);
  };
  return { __esModule: true, default: PagerView };
});

jest.mock('expo-router', () => {
  const Redirect = ({ href }: { href: string }) => `Redirect(${href})`;

  const Stack = ({ children }: { children?: unknown }) => children;
  Stack.Screen = ({ children }: { children?: unknown }) => children ?? null;

  const Tabs = ({ children }: { children?: unknown }) => children;
  Tabs.Screen = (_props: unknown) => null;

  return {
    Redirect,
    Stack,
    Tabs,
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    })),
    usePathname: jest.fn(() => '/'),
  };
});
