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

describe('useCard — view-prop derivation (FR-009, FR-005, FR-006)', () => {
  it('returns isLoading=true and undefined imageUrl while the underlying query is pending', () => {
    jest
      .spyOn(apiModule.apiClient, 'getCardImages')
      .mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(
      () => useCard({ id: ID, footprint: 'pocket' }),
      { wrapper },
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.imageUrl).toBeUndefined();
  });

  it('returns isSuccess=true with images.medium as imageUrl for footprint=pocket', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);
    const { result } = renderHook(
      () => useCard({ id: ID, footprint: 'pocket' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.imageUrl).toBe(IMAGES.medium);
    expect(result.current.error).toBeNull();
  });

  it('returns isSuccess=true with images.large as imageUrl for footprint=detail (FR-009, R5)', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);
    const { result } = renderHook(
      () => useCard({ id: ID, footprint: 'detail' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.imageUrl).toBe(IMAGES.large);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a 404 ApiError directly via result.error.status (FR-005)', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'no', status: 404, kind: 'NOT_FOUND' }),
    );
    const { result } = renderHook(
      () => useCard({ id: ID, footprint: 'pocket' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.status).toBe(404);
    expect(result.current.isSuccess).toBe(false);
  });

  it('surfaces a 503 ApiError after retries exhaust, with a callable onRetry (FR-006)', async () => {
    jest.useFakeTimers();
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
    );
    const { result } = renderHook(
      () => useCard({ id: ID, footprint: 'pocket' }),
      { wrapper },
    );
    for (let index = 0; index < 6; index += 1) {
      await jest.runAllTimersAsync();
    }
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.status).toBe(503);
    expect(typeof result.current.onRetry).toBe('function');
    jest.useRealTimers();
  });

  it('exposes a refetch-bound onRetry that triggers a fresh getCardImages call', async () => {
    jest.useFakeTimers();
    const spy = jest
      .spyOn(apiModule.apiClient, 'getCardImages')
      .mockRejectedValue(
        new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
      );
    const { result } = renderHook(
      () => useCard({ id: ID, footprint: 'pocket' }),
      { wrapper },
    );
    for (let index = 0; index < 6; index += 1) {
      await jest.runAllTimersAsync();
    }
    await waitFor(() => expect(result.current.error).not.toBeNull());
    const initialCalls = spy.mock.calls.length;
    await result.current.onRetry();
    for (let index = 0; index < 6; index += 1) {
      await jest.runAllTimersAsync();
    }
    expect(spy.mock.calls.length).toBeGreaterThan(initialCalls);
    jest.useRealTimers();
  });
});

describe('useCard — return-value reference stability (constitution v1.16.0)', () => {
  it('returns identity-stable onRetry and pulseRef across re-renders with identical inputs', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);
    const { result, rerender } = renderHook(
      ({ id, footprint }: { id: string; footprint: 'pocket' | 'detail' }) =>
        useCard({ id, footprint }),
      { wrapper, initialProps: { id: ID, footprint: 'pocket' as const } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current;
    rerender({ id: ID, footprint: 'pocket' });
    expect(result.current.onRetry).toBe(first.onRetry);
    expect(result.current.pulseRef).toBe(first.pulseRef);
    expect(result.current.imageUrl).toBe(first.imageUrl);
  });
});
