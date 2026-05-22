import type { Card } from '@my-binder/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import { ApiError } from '@src/services/api/ApiError';
import * as apiModule from '@src/services/api/apiClient';
import { buildQueryClient } from '@src/services/api/queryClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useCardDetailQuery } from './useCardDetailQuery';

jest.mock('./useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const ID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';
const CARD: Card = {
  id: ID,
  name: 'Bloodthirsty Conqueror',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-20T00:00:00Z',
  setName: 'The Lost Caverns of Ixalan',
  setCode: 'LCI',
  typeLine: 'Legendary Creature — Demon',
  numberOwned: 2,
};

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const activateSession = () => {
  useSessionStore.setState({ jwt: 'tok', iat: 1, userId: 'u', email: 'e@x.com', status: 'active' });
};

beforeEach(() => {
  activateSession();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'getCard').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCardDetailQuery', () => {
  describe('happy path + queryKey', () => {
    it('returns the parsed Card on success', async () => {
      jest.spyOn(apiModule.apiClient, 'getCard').mockResolvedValue(CARD);
      const { result } = renderHook(() => useCardDetailQuery(ID), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(CARD);
    });

    it("keys the query on ['cards','detail',id] (warm-cache hit, no fetch)", () => {
      client.setQueryData(['cards', 'detail', ID], CARD);
      const spy = jest.spyOn(apiModule.apiClient, 'getCard');
      const { result } = renderHook(() => useCardDetailQuery(ID), { wrapper });
      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toEqual(CARD);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('enabled gating', () => {
    it('does not fetch when session is idle', () => {
      useSessionStore.setState({ jwt: null, iat: null, userId: null, email: null, status: 'idle' });
      const spy = jest.spyOn(apiModule.apiClient, 'getCard');
      renderHook(() => useCardDetailQuery(ID), { wrapper });
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not fetch when id is empty', () => {
      const spy = jest.spyOn(apiModule.apiClient, 'getCard');
      renderHook(() => useCardDetailQuery(''), { wrapper });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('surfaces a 404 as an ApiError', async () => {
      jest.spyOn(apiModule.apiClient, 'getCard').mockRejectedValue(
        new ApiError({ message: 'no', status: 404, kind: 'NOT_FOUND' }),
      );
      const { result } = renderHook(() => useCardDetailQuery(ID), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.status).toBe(404);
    });
  });

  describe('default retry policy (project default — 3 attempts, not a custom budget)', () => {
    it('retries a 503 up to the project default of 3 attempts', async () => {
      jest.useFakeTimers();
      const spy = jest.spyOn(apiModule.apiClient, 'getCard').mockRejectedValue(
        new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
      );
      const localClient = buildQueryClient();
      const localWrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: localClient }, children);

      const { result } = renderHook(() => useCardDetailQuery(ID), { wrapper: localWrapper });
      for (let i = 0; i < 5; i++) await jest.runAllTimersAsync();

      await waitFor(() => expect(result.current.isError).toBe(true));
      // 1 initial + 3 retries = 4 calls under the project default shouldRetry.
      expect(spy).toHaveBeenCalledTimes(4);

      localClient.cancelQueries();
      localClient.clear();
      localClient.unmount();
      jest.useRealTimers();
    });
  });
});
