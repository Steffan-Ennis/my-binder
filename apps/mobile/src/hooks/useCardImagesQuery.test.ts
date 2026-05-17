import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import { ApiError } from '@src/services/api/ApiError';
import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useCardImagesQuery } from './useCardImagesQuery';

jest.mock('./useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const ID_A = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';
const ID_B = '1ca7af0b-4b6a-59ba-90be-6da4f62bcff2';
const IMAGES = {
  small: 'https://example/s.jpg',
  medium: 'https://example/m.jpg',
  large: 'https://example/l.jpg',
};

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const activateSession = () => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
};

beforeEach(() => {
  activateSession();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'getCardImages').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useCardImagesQuery — happy path (FR-003)', () => {
  it('returns the parsed CardImages on success', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);

    const { result } = renderHook(() => useCardImagesQuery(ID_A), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(IMAGES);
  });
});

describe('useCardImagesQuery — id prop change (FR-012)', () => {
  it('discards the in-flight response and re-keys when id changes', async () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useCardImagesQuery(id),
      { wrapper, initialProps: { id: ID_A } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(ID_A);

    rerender({ id: ID_B });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(ID_B);
  });
});

describe('useCardImagesQuery — gating', () => {
  it('does not fetch when session is idle', () => {
    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages');
    renderHook(() => useCardImagesQuery(ID_A), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not fetch when id is empty', () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages');
    renderHook(() => useCardImagesQuery(''), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useCardImagesQuery — request deduplication (FR-007)', () => {
  it('fires fetch exactly once when the same id is queried by two consumers on the same client', async () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages').mockResolvedValue(IMAGES);

    const A = renderHook(() => useCardImagesQuery(ID_A), { wrapper });
    const B = renderHook(() => useCardImagesQuery(ID_A), { wrapper });

    await waitFor(() => expect(A.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(B.result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('useCardImagesQuery — warm-cache hit (FR-008)', () => {
  it('resolves to data on first call without entering pending state when pre-seeded', () => {
    client.setQueryData(['cards', 'images', ID_A], IMAGES);
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages');

    const { result } = renderHook(() => useCardImagesQuery(ID_A), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual(IMAGES);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useCardImagesQuery — 4xx skip-retry (FR-005, FR-006)', () => {
  it('surfaces a 404 ApiError immediately without retrying', async () => {
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'no', status: 404, kind: 'NOT_FOUND' }),
    );

    const { result } = renderHook(() => useCardImagesQuery(ID_A), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.failureCount).toBe(1);
  });
});

describe('useCardImagesQuery — 5xx retry budget (FR-006)', () => {
  it('exhausts 5 attempts on 503 then surfaces the error', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
    );

    // Disable test-level retry override so the hook's own retry budget governs.
    const localClient = new QueryClient();
    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: localClient }, children);

    const { result } = renderHook(() => useCardImagesQuery(ID_A), { wrapper: localWrapper });

    // Drive all back-off timers: 1s → 2s → 4s → 8s → 16s
    for (let i = 0; i < 6; i++) {
      await jest.runAllTimersAsync();
    }

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledTimes(5);

    localClient.cancelQueries();
    localClient.clear();
    localClient.unmount();
    jest.useRealTimers();
  });

  it('refetch() after exhaustion issues a fresh attempt cycle', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(apiModule.apiClient, 'getCardImages').mockRejectedValue(
      new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
    );

    const localClient = new QueryClient();
    const localWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: localClient }, children);

    const { result } = renderHook(() => useCardImagesQuery(ID_A), { wrapper: localWrapper });
    for (let i = 0; i < 6; i++) {
      await jest.runAllTimersAsync();
    }
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = spy.mock.calls.length;

    void result.current.refetch();
    for (let i = 0; i < 6; i++) {
      await jest.runAllTimersAsync();
    }
    expect(spy.mock.calls.length).toBeGreaterThan(before);

    localClient.cancelQueries();
    localClient.clear();
    localClient.unmount();
    jest.useRealTimers();
  });
});

describe('useCardImagesQuery — unmount cancellation safety (FR-013)', () => {
  it('does not throw when the hook unmounts mid-fetch', async () => {
    jest.spyOn(apiModule.apiClient, 'getCardImages').mockImplementation(
      () => new Promise(() => {}),
    );

    const { unmount } = renderHook(() => useCardImagesQuery(ID_A), { wrapper });
    expect(() => unmount()).not.toThrow();
  });
});
