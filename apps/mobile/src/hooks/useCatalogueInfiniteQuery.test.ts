import type { CardRecord, SearchResult } from '@my-binder/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import { useCatalogueInfiniteQuery } from './useCatalogueInfiniteQuery';

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

const makeCardRecord = (id: string, name: string): CardRecord => ({
  id,
  name,
  set: 'M11',
  cardNumber: '1',
  manaCost: null,
  colorIdentity: [],
});

const makePage = (
  page: number,
  cards: CardRecord[],
  totalPages: number,
  total = totalPages * SLOTS_PER_BINDER_PAGE,
): SearchResult => ({
  cards,
  total,
  page,
  limit: SLOTS_PER_BINDER_PAGE,
  totalPages,
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
  jest.spyOn(apiModule.apiClient, 'searchCards').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCatalogueInfiniteQuery', () => {
  it('returns the validated SearchResult across pages on the happy path', async () => {
    const spy = jest
      .spyOn(apiModule.apiClient, 'searchCards')
      .mockResolvedValue(makePage(1, [makeCardRecord('1', 'Lightning Bolt')], 3));

    const { result } = renderHook(
      () => useCatalogueInfiniteQuery({ name: 'bolt' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bolt', page: 1, limit: SLOTS_PER_BINDER_PAGE }),
    );
    expect(result.current.data?.pages[0]?.cards.length).toBe(1);
  });

  it('uses initialPageParam=1 (first page request is page=1)', async () => {
    const spy = jest
      .spyOn(apiModule.apiClient, 'searchCards')
      .mockResolvedValue(makePage(1, [], 1));

    renderHook(() => useCatalogueInfiniteQuery({ name: 'x' }), { wrapper });
    await waitFor(() => expect(spy).toHaveBeenCalled());

    expect(spy.mock.calls[0]?.[0]?.page).toBe(1);
  });

  it('getNextPageParam returns undefined when page === totalPages', async () => {
    jest
      .spyOn(apiModule.apiClient, 'searchCards')
      .mockResolvedValue(makePage(1, [makeCardRecord('1', 'a')], 1));

    const { result } = renderHook(
      () => useCatalogueInfiniteQuery({ name: 'a' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('hasNextPage=true when page < totalPages', async () => {
    jest
      .spyOn(apiModule.apiClient, 'searchCards')
      .mockResolvedValue(makePage(1, [makeCardRecord('1', 'a')], 5));

    const { result } = renderHook(
      () => useCatalogueInfiniteQuery({ name: 'a' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('queryKey isolates caches across distinct filter shapes', async () => {
    const spy = jest
      .spyOn(apiModule.apiClient, 'searchCards')
      .mockResolvedValue(makePage(1, [], 1));

    const { rerender } = renderHook(
      ({ name }: { name: string }) => useCatalogueInfiniteQuery({ name }),
      { wrapper, initialProps: { name: 'bolt' } },
    );
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    rerender({ name: 'goblin' });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it('does not fetch when session is idle (enabled gate)', () => {
    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });
    const spy = jest.spyOn(apiModule.apiClient, 'searchCards');
    renderHook(() => useCatalogueInfiniteQuery({ name: 'x' }), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });
});
