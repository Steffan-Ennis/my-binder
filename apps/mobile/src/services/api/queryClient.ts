import { QueryClient } from '@tanstack/react-query';

import { useSessionStore } from '@src/stores/sessionStore';

import { ApiError } from './ApiError';

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const MAX_RETRY_DELAY_MS = 30_000;

export const computeRetryDelay = (attemptIndex: number): number => {
  const exact = RETRY_DELAYS_MS[attemptIndex];
  if (typeof exact === 'number') return exact;
  return Math.min(MAX_RETRY_DELAY_MS, RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] * 2 ** (attemptIndex - RETRY_DELAYS_MS.length + 1));
};

export const isFourXX = (err: unknown): boolean => {
  if (!(err instanceof ApiError)) return false;
  if (err.status === null) return false;
  return err.status >= 400 && err.status < 500;
};

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 3) return false;
  if (isFourXX(error)) return false;
  return true;
};

let onAuthError: (kind: 'session_invalid' | 'access_denied') => void = () => {};

/**
 * Register the navigation/cleanup handler that runs when the global query/mutation
 * caches surface a 401 or 403. Wired during app boot in `app/_layout.tsx`.
 *
 * @param handler - called with `'session_invalid'` on 401 (clear session + Login) or `'access_denied'` on 403
 *
 * @example
 *   registerAuthErrorHandler((kind) => {
 *     if (kind === 'session_invalid') router.replace('/login');
 *     if (kind === 'access_denied') router.replace('/access-denied');
 *   });
 */
export const registerAuthErrorHandler = (
  handler: (kind: 'session_invalid' | 'access_denied') => void,
): void => {
  onAuthError = handler;
};

const handleGlobalError = (err: unknown): void => {
  if (!(err instanceof ApiError)) return;
  if (err.kind === 'AUTH_INVALID_TOKEN') {
    useSessionStore.getState().clearSession();
    onAuthError('session_invalid');
  } else if (err.kind === 'AUTH_NOT_ALLOWLISTED') {
    onAuthError('access_denied');
  }
};

/**
 * Build the singleton TanStack `QueryClient` for the mobile app.
 *
 * Defaults match `contracts/api-client.md`:
 *   - queries: `retry: 3` exponential 1s/2s/4s capped at 30s; 4xx skipped
 *   - mutations: `retry: 0`
 *   - `refetchOnWindowFocus: false`, `retryOnMount: false`
 *
 * @returns a freshly constructed `QueryClient` with the auth-error caches wired
 *
 * @example
 *   <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
 */
export const buildQueryClient = (): QueryClient => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: computeRetryDelay,
        refetchOnWindowFocus: false,
        retryOnMount: false,
        staleTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
  client.getQueryCache().config.onError = handleGlobalError;
  client.getMutationCache().config.onError = handleGlobalError;
  return client;
};

export const queryClient = buildQueryClient();