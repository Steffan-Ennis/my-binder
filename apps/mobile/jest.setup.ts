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

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'mybinder://redirect'),
  ResponseType: { Token: 'token', IdToken: 'id_token' },
  revokeAsync: jest.fn(),
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