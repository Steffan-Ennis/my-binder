import Ajv, { type ValidateFunction } from 'ajv';
import Constants from 'expo-constants';

import { useSessionStore } from '@src/stores/sessionStore';

import { ApiError, type ApiErrorKind } from './ApiError';
import {
  AUTH_ME_RESPONSE_SCHEMA,
  CARD_LIST_RESPONSE_SCHEMA,
  GOOGLE_SIGN_IN_RESPONSE_SCHEMA,
  type AuthMeResponse,
  type CardListResponse,
  type GoogleSignInResponse,
} from './schemas';

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  useDefaults: false,
  // Register `format: 'uuid'` and `format: 'date-time'` from the canonical
  // `@my-binder/core` card schema as no-op string checks. Ajv-core does not
  // ship these formats; the mobile client accepts any string for them and
  // relies on the server-side Ajv (with ajv-formats registered) to enforce
  // structural correctness at the source of truth.
  formats: { uuid: true, 'date-time': true },
});

const validateGoogleSignInResponse = ajv.compile(GOOGLE_SIGN_IN_RESPONSE_SCHEMA);
const validateAuthMeResponse = ajv.compile(AUTH_ME_RESPONSE_SCHEMA);
const validateCardListResponse = ajv.compile(CARD_LIST_RESPONSE_SCHEMA);

const getApiBaseUrl = (): string => {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  if (!extra?.apiBaseUrl) {
    throw new Error('apiClient: API_BASE_URL is not configured in expo.extra');
  }
  return extra.apiBaseUrl.replace(/\/$/, '');
};

const buildHeaders = (extra: HeadersInit = {}): HeadersInit => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(extra as Record<string, string>),
  };
  const { jwt, status } = useSessionStore.getState();
  if (jwt && status === 'active') {
    headers.Authorization = `Bearer ${jwt}`;
  }
  return headers;
};

const mapStatusToKind = (status: number | null, body: unknown): ApiErrorKind => {
  const code = (body as { error?: { code?: string }; code?: string } | null)?.error?.code
    ?? (body as { code?: string } | null)?.code;
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return code === 'AUTH_INVALID_GOOGLE_TOKEN' ? 'AUTH_INVALID_GOOGLE_TOKEN' : 'AUTH_INVALID_TOKEN';
  if (status === 403) return 'AUTH_NOT_ALLOWLISTED';
  if (status === null) return 'NETWORK_OFFLINE';
  return 'UNKNOWN';
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const fetchJson = async <T>(input: {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
  validator: ValidateFunction | null;
  expectStatus?: number;
}): Promise<T | null> => {
  const url = `${getApiBaseUrl()}${input.path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method,
      headers: buildHeaders(),
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
    });
  } catch (cause) {
    console.error(`[apiClient] network failure for ${input.method} ${input.path}`, cause);
    throw new ApiError({
      message: 'Network unavailable',
      status: null,
      kind: 'NETWORK_OFFLINE',
      cause,
    });
  }

  if (!response.ok) {
    const body = await parseJsonSafely(response);
    console.error(`[apiClient] non-OK response ${response.status} for ${input.method} ${input.path}`, body);
    throw new ApiError({
      message: `Request failed with status ${response.status}`,
      status: response.status,
      kind: mapStatusToKind(response.status, body),
      cause: body,
    });
  }

  if (input.expectStatus === 204 || !input.validator) return null;

  const json = await parseJsonSafely(response);
  if (!input.validator(json)) {
    console.error(
      `[apiClient] schema validation failed for ${input.method} ${input.path}`,
      input.validator.errors,
    );
    throw new ApiError({
      message: 'Response failed schema validation',
      status: response.status,
      kind: 'SCHEMA_VALIDATION_ERROR',
      cause: input.validator.errors,
    });
  }
  return json as T;
};

/**
 * Sign in with Google. Posts the Google ID token to the server and resolves with the
 * issued session JWT and the authenticated user record. Caller persists the session.
 *
 * @param input - `{ idToken }` from `expo-auth-session/providers/google`
 * @returns the validated server response
 * @throws {ApiError} with `kind: 'AUTH_INVALID_GOOGLE_TOKEN'` (401) | `'AUTH_NOT_ALLOWLISTED'` (403) | `'NETWORK_OFFLINE'` | `'SCHEMA_VALIDATION_ERROR'`
 *
 * @example
 *   const result = await signInWithGoogle({ idToken });
 *   await writeSession({ jwt: result.token!, iat: Math.floor(Date.now() / 1000) });
 */
export const signInWithGoogle = async (input: { idToken: string }): Promise<GoogleSignInResponse> => {
  return await fetchJson<GoogleSignInResponse>({
    path: '/auth/google',
    method: 'POST',
    body: input,
    validator: validateGoogleSignInResponse,
  }) as GoogleSignInResponse;
};

/**
 * Hydrate the authenticated user record. Used to validate that a re-hydrated session
 * is still active server-side before navigating away from the Login route.
 *
 * @returns the validated `{ user }` payload
 * @throws {ApiError} with `kind: 'AUTH_INVALID_TOKEN'` (401) | `'AUTH_NOT_ALLOWLISTED'` (403)
 */
export const getMe = async (): Promise<AuthMeResponse> => {
  const body = await fetchJson<AuthMeResponse>({
    path: '/auth/me',
    method: 'GET',
    validator: validateAuthMeResponse,
  });
  return body as AuthMeResponse;
};

/**
 * Sign out server-side. Best-effort: failures here are swallowed by the caller so
 * the local cleanup chain (`expo-secure-store`, `queryClient.clear()`, navigation)
 * always runs.
 *
 * @returns void on 204
 * @throws {ApiError} on non-204 responses or network failures
 */
export const signOut = async (): Promise<void> => {
  await fetchJson<null>({
    path: '/auth/signout',
    method: 'POST',
    validator: null,
    expectStatus: 204,
  });
};

/**
 * Fetch a page of the authenticated user's collection. Page boundary is determined
 * server-side; the next opaque cursor is returned in the response body.
 *
 * @param cursor - opaque cursor returned by the previous call (omit for the first page)
 * @returns `{ cards, nextCursor }` validated against `CARD_LIST_RESPONSE_SCHEMA`
 * @throws {ApiError} on 401/403/5xx/network/schema-validation failures
 *
 * @example
 *   const first = await getCards();
 *   if (first.nextCursor) await getCards(first.nextCursor);
 */
export const getCards = async (cursor?: string): Promise<CardListResponse> => {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const body = await fetchJson<CardListResponse>({
    path: `/cards${qs}`,
    method: 'GET',
    validator: validateCardListResponse,
  });
  return body as CardListResponse;
};

export const apiClient = {
  signInWithGoogle,
  getMe,
  signOut,
  getCards,
};

export type ApiClient = typeof apiClient;
