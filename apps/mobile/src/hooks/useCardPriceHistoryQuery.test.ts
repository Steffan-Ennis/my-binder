import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import {
  FIXTURE_PRINTING_ID,
  HISTORY_BOTH_SERIES,
} from '@src/components/card-detail-sheet/fixtures';
import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useCardPriceHistoryQuery } from './useCardPriceHistoryQuery';

jest.mock('./useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const ID = FIXTURE_PRINTING_ID;

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  useSessionStore.setState({ jwt: 'tok', iat: 1, userId: 'u', email: 'e@x.com', status: 'active' });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'getCardPriceHistory').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCardPriceHistoryQuery', () => {
  it('returns the validated CardPriceHistoryResponse on success', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardPriceHistory').mockResolvedValue(HISTORY_BOTH_SERIES);
    const { result } = renderHook(() => useCardPriceHistoryQuery(ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(HISTORY_BOTH_SERIES);
  });

  it('defaults the window to 30 days and forwards it to the apiClient', async () => {
    const spy = jest
      .spyOn(apiModule.apiClient, 'getCardPriceHistory')
      .mockResolvedValue(HISTORY_BOTH_SERIES);
    const { result } = renderHook(() => useCardPriceHistoryQuery(ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(ID, 30);
  });

  it("keys the query on ['cards','prices','history',id,days] (warm-cache hit at 30d)", () => {
    client.setQueryData(['cards', 'prices', 'history', ID, 30], HISTORY_BOTH_SERIES);
    const spy = jest.spyOn(apiModule.apiClient, 'getCardPriceHistory');
    const { result } = renderHook(() => useCardPriceHistoryQuery(ID), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual(HISTORY_BOTH_SERIES);
    expect(spy).not.toHaveBeenCalled();
  });

  it('re-keys and refetches for a non-default window', async () => {
    const spy = jest
      .spyOn(apiModule.apiClient, 'getCardPriceHistory')
      .mockResolvedValue(HISTORY_BOTH_SERIES);
    // Seeding only the 30d key must not satisfy a 7d query.
    client.setQueryData(['cards', 'prices', 'history', ID, 30], HISTORY_BOTH_SERIES);
    const { result } = renderHook(() => useCardPriceHistoryQuery(ID, 7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(ID, 7);
  });

  it('does not fetch when session is idle', () => {
    useSessionStore.setState({ jwt: null, iat: null, userId: null, email: null, status: 'idle' });
    const spy = jest.spyOn(apiModule.apiClient, 'getCardPriceHistory');
    renderHook(() => useCardPriceHistoryQuery(ID), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not fetch when id is empty', () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCardPriceHistory');
    renderHook(() => useCardPriceHistoryQuery(''), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });
});
