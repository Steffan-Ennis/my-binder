import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import { ApiError } from '@src/services/api/ApiError';
import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useCard } from './useCard';

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const IMAGES = {
  small: 'https://example/s.jpg',
  medium: 'https://example/m.jpg',
  large: 'https://example/l.jpg',
};
const ID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'getCardImages').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCard — state derivation (FR-009, FR-005, FR-006)', () => {
  it('returns loading state while the underlying query is pending', () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockImplementation(
      () => new Promise(() => {}),
    );
    const { result } = renderHook(() => useCard(ID, 'pocket'), { wrapper });
    expect(result.current.state.kind).toBe('loading');
    expect(result.current.footprint).toBe('pocket');
  });

  it('returns loaded with images.medium for footprint=pocket', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);
    const { result } = renderHook(() => useCard(ID, 'pocket'), { wrapper });
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    expect(result.current.state).toEqual({ kind: 'loaded', imageUrl: IMAGES.medium });
  });

  it('returns loaded with images.large for footprint=detail (FR-009, R5)', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);
    const { result } = renderHook(() => useCard(ID, 'detail'), { wrapper });
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    expect(result.current.state).toEqual({ kind: 'loaded', imageUrl: IMAGES.large });
  });

  it('maps CARD_NOT_FOUND to notFound view-state (FR-005)', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'no', status: 404, kind: 'CARD_NOT_FOUND' }),
    );
    const { result } = renderHook(() => useCard(ID, 'pocket'), { wrapper });
    await waitFor(() => expect(result.current.state.kind).toBe('notFound'));
  });

  it('maps PROVIDER_UNAVAILABLE to error view-state with onRetry (FR-006)', async () => {
    jest.useFakeTimers();
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
    );
    const { result } = renderHook(() => useCard(ID, 'pocket'), { wrapper });
    for (let i = 0; i < 6; i++) {
      await jest.runAllTimersAsync();
    }
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(typeof result.current.state.onRetry).toBe('function');
    }
    jest.useRealTimers();
  });

  it('exposes a refetch-bound onRetry that triggers a fresh getCardImages call', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
    );
    const { result } = renderHook(() => useCard(ID, 'pocket'), { wrapper });
    for (let i = 0; i < 6; i++) {
      await jest.runAllTimersAsync();
    }
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const initialCalls = spy.mock.calls.length;
    if (result.current.state.kind === 'error') {
      result.current.state.onRetry();
    }
    for (let i = 0; i < 6; i++) {
      await jest.runAllTimersAsync();
    }
    expect(spy.mock.calls.length).toBeGreaterThan(initialCalls);
    jest.useRealTimers();
  });
});

describe('useCard — return value identity stability (constitution v1.16.0)', () => {
  it('returns a reference-equal CardViewProps object across re-renders with identical inputs', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);
    const { result, rerender } = renderHook(
      ({ id, footprint }: { id: string; footprint: 'pocket' | 'detail' }) =>
        useCard(id, footprint),
      { wrapper, initialProps: { id: ID, footprint: 'pocket' as const } },
    );
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    const first = result.current;
    rerender({ id: ID, footprint: 'pocket' });
    expect(result.current).toBe(first);
  });
});
