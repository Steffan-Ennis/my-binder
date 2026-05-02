import { useSessionStore } from '@src/stores/sessionStore';

import { ApiError } from './ApiError';
import { buildQueryClient, registerAuthErrorHandler } from './queryClient';

beforeEach(() => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
});

describe('queryClient defaults', () => {
  it('disables refetchOnWindowFocus and retryOnMount', () => {
    const client = buildQueryClient();
    const opts = client.getDefaultOptions();
    expect(opts.queries?.refetchOnWindowFocus).toBe(false);
    expect(opts.queries?.retryOnMount).toBe(false);
  });

  it('mutations never auto-retry', () => {
    const client = buildQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('queries retry up to 3 times on 5xx/network and skip 4xx', () => {
    const client = buildQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') throw new Error('retry should be a predicate');

    const fivexx = new ApiError({ message: 'x', status: 500, kind: 'UNKNOWN' });
    const fourxx = new ApiError({ message: 'x', status: 401, kind: 'AUTH_INVALID_TOKEN' });
    const offline = new ApiError({ message: 'x', status: null, kind: 'NETWORK_OFFLINE' });

    expect(retry(0, fivexx)).toBe(true);
    expect(retry(2, fivexx)).toBe(true);
    expect(retry(3, fivexx)).toBe(false);
    expect(retry(0, fourxx)).toBe(false);
    expect(retry(0, offline)).toBe(true);
  });

  it('queries retryDelay exponentially backs off 1s → 2s → 4s', () => {
    const client = buildQueryClient();
    const delay = client.getDefaultOptions().queries?.retryDelay;
    if (typeof delay !== 'function') throw new Error('retryDelay should be a function');

    expect(delay(0, new Error('e'))).toBe(1_000);
    expect(delay(1, new Error('e'))).toBe(2_000);
    expect(delay(2, new Error('e'))).toBe(4_000);
    expect(delay(10, new Error('e'))).toBeLessThanOrEqual(30_000);
  });
});

describe('queryClient global error routing', () => {
  it('clears session and dispatches session_invalid on AUTH_INVALID_TOKEN', () => {
    const client = buildQueryClient();
    const handler = jest.fn();
    registerAuthErrorHandler(handler);

    const onError = client.getQueryCache().config.onError as
      | ((err: unknown, query: unknown) => void)
      | undefined;
    onError?.(new ApiError({ message: 'x', status: 401, kind: 'AUTH_INVALID_TOKEN' }), undefined);

    expect(useSessionStore.getState().status).toBe('idle');
    expect(handler).toHaveBeenCalledWith('session_invalid');
  });

  it('dispatches access_denied on AUTH_NOT_ALLOWLISTED without clearing session', () => {
    const client = buildQueryClient();
    const handler = jest.fn();
    registerAuthErrorHandler(handler);

    const onError = client.getMutationCache().config.onError as
      | ((err: unknown, vars: unknown, ctx: unknown, mut: unknown) => void)
      | undefined;
    onError?.(
      new ApiError({ message: 'x', status: 403, kind: 'AUTH_NOT_ALLOWLISTED' }),
      undefined,
      undefined,
      undefined,
    );

    expect(handler).toHaveBeenCalledWith('access_denied');
  });
});