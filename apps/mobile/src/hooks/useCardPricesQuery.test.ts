import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import {
  FIXTURE_PRINTING_ID,
  PRICES_BOTH_PRESENT,
} from '@src/components/card-detail-sheet/fixtures';
import { ApiError } from '@src/services/api/ApiError';
import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useCardPricesQuery } from './useCardPricesQuery';

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
  jest.spyOn(apiModule.apiClient, 'getCardPrices').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCardPricesQuery', () => {
  it('returns the validated CardPricesResponse on success', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardPrices').mockResolvedValue(PRICES_BOTH_PRESENT);
    const { result } = renderHook(() => useCardPricesQuery(ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PRICES_BOTH_PRESENT);
  });

  it("keys the query on ['cards','prices',id] (warm-cache hit, no fetch)", () => {
    client.setQueryData(['cards', 'prices', ID], PRICES_BOTH_PRESENT);
    const spy = jest.spyOn(apiModule.apiClient, 'getCardPrices');
    const { result } = renderHook(() => useCardPricesQuery(ID), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual(PRICES_BOTH_PRESENT);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not fetch when session is idle', () => {
    useSessionStore.setState({ jwt: null, iat: null, userId: null, email: null, status: 'idle' });
    const spy = jest.spyOn(apiModule.apiClient, 'getCardPrices');
    renderHook(() => useCardPricesQuery(ID), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not fetch when id is empty', () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCardPrices');
    renderHook(() => useCardPricesQuery(''), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });

  it('passes an ApiError through unchanged', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardPrices').mockRejectedValue(
      new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
    );
    const { result } = renderHook(() => useCardPricesQuery(ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.kind).toBe('PROVIDER_UNAVAILABLE');
  });
});
