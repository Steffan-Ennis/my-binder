import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { type FC, type ReactNode } from 'react';

import { useSessionStore } from '@src/stores/sessionStore';

import CardContainer from './CardContainer';

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const session = store.getState();
      return {
        status: session.status,
        userId: session.userId,
        email: session.email,
        jwt: session.jwt,
      };
    },
  };
});

const ID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';
const IMAGES = {
  small: 'https://example/s.jpg',
  medium: 'https://example/m.jpg',
  large: 'https://example/l.jpg',
};

let client: QueryClient;

const Provider: FC<{ children: ReactNode }> = ({ children }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('CardContainer — Principle X wiring', () => {
  it('renders the loading view on cold cache', () => {
    const screen = render(
      <Provider>
        <CardContainer id={ID} footprint="pocket" />
      </Provider>,
    );
    expect(screen.getByTestId('card-loading')).toBeTruthy();
  });

  it('renders the loaded view when the query cache is pre-seeded with images (footprint=pocket)', () => {
    client.setQueryData(['cards', 'images', ID], IMAGES);
    const screen = render(
      <Provider>
        <CardContainer id={ID} footprint="pocket" />
      </Provider>,
    );
    expect(screen.getByTestId('card-loaded')).toBeTruthy();
  });

  it('renders the loaded view when the query cache is pre-seeded with images (footprint=detail)', () => {
    client.setQueryData(['cards', 'images', ID], IMAGES);
    const screen = render(
      <Provider>
        <CardContainer id={ID} footprint="detail" />
      </Provider>,
    );
    expect(screen.getByTestId('card-loaded')).toBeTruthy();
  });
});
