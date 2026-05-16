import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { ApiError } from '@src/services/api/ApiError';
import { useSessionStore } from '@src/stores/sessionStore';

import { useCardsInfiniteQuery } from './useCardsInfiniteQuery';

jest.mock('./useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const makeCard = (id: string, name: string) => ({
  id,
  name,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
});

beforeEach(() => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'getCards').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCardsInfiniteQuery', () => {
  it('returns the validated cards across pages on the happy path', async () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCards').mockResolvedValue({
      cards: [makeCard('1', 'Lightning Bolt'), makeCard('2', 'Counterspell')],
      total: 2,
      nextCursor: null,
    });

    const { result } = renderHook(() => useCardsInfiniteQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.data?.pages[0]?.cards.length).toBe(2);
    expect(result.current.data?.pages[0]?.cards[0]?.name).toBe('Lightning Bolt');
  });

  it('exposes isLoading then transitions to success', async () => {
    let resolve: (v: { cards: ReturnType<typeof makeCard>[]; total: number; nextCursor: null }) => void = () => {};
    jest.spyOn(apiModule.apiClient, 'getCards').mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );

    const { result } = renderHook(() => useCardsInfiniteQuery(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    resolve({ cards: [], total: 0, nextCursor: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('surfaces transient 5xx errors as isError true', async () => {
    jest.spyOn(apiModule.apiClient, 'getCards').mockRejectedValue(
      new ApiError({ message: 'boom', status: 500, kind: 'UNKNOWN' }),
    );

    const { result } = renderHook(() => useCardsInfiniteQuery(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it('does not fetch when session is idle (enabled gate)', () => {
    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });
    const spy = jest.spyOn(apiModule.apiClient, 'getCards');
    renderHook(() => useCardsInfiniteQuery(), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reduces to a single fetch when nextCursor is null (no pagination today)', async () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCards').mockResolvedValue({
      cards: [makeCard('1', 'Lightning Bolt')],
      total: 1,
      nextCursor: null,
    });

    const { result } = renderHook(() => useCardsInfiniteQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.hasNextPage).toBe(false);
  });
});
