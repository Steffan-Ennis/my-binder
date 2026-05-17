import Ajv, { type ValidateFunction } from 'ajv';
import Constants from 'expo-constants';

import { useSessionStore } from '@src/stores/sessionStore';

import { ApiError, type ApiErrorKind } from './ApiError';
import {
  AUTH_ME_RESPONSE_SCHEMA,
  CARD_IMAGES_RESPONSE_SCHEMA,
  CARD_LIST_RESPONSE_SCHEMA,
  CARD_PRICES_RESPONSE_SCHEMA,
  CARD_PRICE_HISTORY_RESPONSE_SCHEMA,
  CARD_RESPONSE_SCHEMA,
  GOOGLE_SIGN_IN_RESPONSE_SCHEMA,
  SEARCH_RESULT_SCHEMA,
  type AuthMeResponse,
  type Card,
  type CardImages,
  type CardListResponse,
  type CardPriceHistoryResponse,
  type CardPricesResponse,
  type GoogleSignInResponse,
  type PatchCardBody,
  type SearchQuery,
  type SearchResult,
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
  formats: { uuid: true, 'date-time': true, date: true },
});

const validateGoogleSignInResponse = ajv.compile(GOOGLE_SIGN_IN_RESPONSE_SCHEMA);
const validateAuthMeResponse = ajv.compile(AUTH_ME_RESPONSE_SCHEMA);
const validateCardListResponse = ajv.compile(CARD_LIST_RESPONSE_SCHEMA);
const validateCardImages = ajv.compile(CARD_IMAGES_RESPONSE_SCHEMA);
const validateCard = ajv.compile(CARD_RESPONSE_SCHEMA);
const validateSearchResult = ajv.compile(SEARCH_RESULT_SCHEMA);
const validateCardPrices = ajv.compile(CARD_PRICES_RESPONSE_SCHEMA);
const validateCardPriceHistory = ajv.compile(CARD_PRICE_HISTORY_RESPONSE_SCHEMA);

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
  const bodyError = (body as { error?: string | { code?: string } } | null)?.error;
  const code = typeof bodyError === 'string'
    ? bodyError
    : bodyError?.code ?? (body as { code?: string } | null)?.code;
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return code === 'AUTH_INVALID_GOOGLE_TOKEN' ? 'AUTH_INVALID_GOOGLE_TOKEN' : 'AUTH_INVALID_TOKEN';
  if (status === 403) return 'AUTH_NOT_ALLOWLISTED';
  if (status === 404 && code === 'CARD_NOT_FOUND') return 'NOT_FOUND';
  if (status === 503 && code === 'PROVIDER_UNAVAILABLE') return 'PROVIDER_UNAVAILABLE';
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
      kind: 'VALIDATION_ERROR',
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

/**
 * Fetch the small/medium/large image URLs for a single owned card via
 * `GET /cards/images/:id`. Consumed by the reusable `<Card />` component
 * (spec 017) — the image URLs are no longer eager-emitted by `/cards`.
 *
 * @param id - MTGJSON printing UUID.
 * @returns the parsed `CardImages` payload (validated against `CARD_IMAGES_RESPONSE_SCHEMA`).
 * @throws {ApiError} with `kind: 'CARD_NOT_FOUND'` (404), `'PROVIDER_UNAVAILABLE'` (503),
 *   `'AUTH_INVALID_TOKEN'` (401), `'VALIDATION_ERROR'` (400), `'NETWORK_OFFLINE'`,
 *   or `'SCHEMA_VALIDATION_ERROR'` when the payload fails Ajv validation.
 *
 * @example
 *   const images = await getCardImages('6ca7af0b-4b6a-59ba-90be-6da4f62bcff1');
 */
export const getCardImages = async (id: string): Promise<CardImages> => {
  const body = await fetchJson<CardImages>({
    path: `/cards/images/${encodeURIComponent(id)}`,
    method: 'GET',
    validator: validateCardImages,
  });
  return body as CardImages;
};

/**
 * Search the global card catalogue (spec 018 / FR-005, FR-013).
 * Serialises array filter dimensions as comma-separated querystring values.
 *
 * @param query - filter dimensions + page + limit. See {@link SearchQuery}.
 * @returns the validated `SearchResult` body.
 * @throws {ApiError} on 401/403/4xx/5xx/network/schema failures.
 *
 * @example
 *   const res = await searchCards({ formats: ['Modern'], page: 1, limit: 9 });
 */
export const searchCards = async (query: SearchQuery): Promise<SearchResult> => {
  const params = new URLSearchParams();
  if (query.name) params.set('name', query.name);
  if (query.set) params.set('set', query.set);
  if (query.colorIdentity?.length) params.set('colors', query.colorIdentity.join(','));
  if (query.cmcMin != null) params.set('cmc_min', String(query.cmcMin));
  if (query.cmcMax != null) params.set('cmc_max', String(query.cmcMax));
  if (query.formats?.length) params.set('formats', query.formats.join(','));
  if (query.superTypes?.length) params.set('super_types', query.superTypes.join(','));
  if (query.subTypes?.length) params.set('sub_types', query.subTypes.join(','));
  if (query.creatureTypes?.length) params.set('creature_types', query.creatureTypes.join(','));
  if (query.missingOnly) params.set('missing_only', 'true');
  if (query.page != null) params.set('page', String(query.page));
  if (query.limit != null) params.set('limit', String(query.limit));
  const body = await fetchJson<SearchResult>({
    path: `/cards/search?${params.toString()}`,
    method: 'GET',
    validator: validateSearchResult,
  });
  return body as SearchResult;
};

/**
 * Fetch the latest per-source price quote for one printing (spec 018 / FR-017).
 *
 * @param id - MTGJSON printing UUID.
 * @returns the validated `CardPricesResponse`; `null` slots when no observation.
 * @throws {ApiError} on 404 (`NOT_FOUND`), 503 (`PROVIDER_UNAVAILABLE`), or schema failures.
 *
 * @example
 *   const prices = await getCardPrices('6ca7af0b-…');
 */
export const getCardPrices = async (id: string): Promise<CardPricesResponse> => {
  const body = await fetchJson<CardPricesResponse>({
    path: `/cards/${encodeURIComponent(id)}/prices`,
    method: 'GET',
    validator: validateCardPrices,
  });
  return body as CardPricesResponse;
};

/**
 * Fetch the per-source price history for one printing (spec 018 / FR-018).
 *
 * @param id - MTGJSON printing UUID.
 * @param days - window length in calendar days (default 30 server-side).
 * @returns the validated `CardPriceHistoryResponse`.
 *
 * @example
 *   const history = await getCardPriceHistory('6ca7af0b-…', 30);
 */
export const getCardPriceHistory = async (
  id: string,
  days: number,
): Promise<CardPriceHistoryResponse> => {
  const body = await fetchJson<CardPriceHistoryResponse>({
    path: `/cards/${encodeURIComponent(id)}/prices/history?days=${days}`,
    method: 'GET',
    validator: validateCardPriceHistory,
  });
  return body as CardPriceHistoryResponse;
};

/**
 * Fetch a single owned card by its MTGJSON printing UUID. Used by the card
 * detail sheet to hydrate hero metadata not present in the catalogue payload.
 *
 * @param id - MTGJSON printing UUID.
 * @returns the validated `Card`.
 * @throws {ApiError} with `kind: 'NOT_FOUND'` (404).
 *
 * @example
 *   const card = await getCard('6ca7af0b-…');
 */
export const getCard = async (id: string): Promise<Card> => {
  const body = await fetchJson<Card>({
    path: `/cards/${encodeURIComponent(id)}`,
    method: 'GET',
    validator: validateCard,
  });
  return body as Card;
};

/**
 * Upsert a card into the binder (spec 018 / FR-025). A fresh `(id, userId)`
 * pair creates a row at `numberOwned=1`; a duplicate increments. The server
 * returns the resulting Card in either case.
 *
 * @param input - `{ id, name }` where `id` is the MTGJSON printing UUID.
 * @returns the validated `Card`.
 *
 * @example
 *   await upsertCard({ id: '…', name: 'Lightning Bolt' });
 */
export const upsertCard = async (input: { id: string; name: string }): Promise<Card> => {
  const body = await fetchJson<Card>({
    path: '/cards',
    method: 'POST',
    body: input,
    validator: validateCard,
  });
  return body as Card;
};

/**
 * Increment or decrement a card's `numberOwned` (spec 018 / FR-026, FR-028).
 * `delta: -1` at `numberOwned = 1` deletes the row server-side and returns
 * 204; the response shape distinguishes the two outcomes.
 *
 * @param id - MTGJSON printing UUID.
 * @param body - `{ delta: 1 | -1 }`.
 * @returns `{ status: 200, card }` when the row remains, `{ status: 204 }` when deleted.
 * @throws {ApiError} with `kind: 'NOT_FOUND'` (404) when the row doesn't exist.
 *
 * @example
 *   const result = await patchCard(printingId, { delta: -1 });
 *   if (result.status === 204) { … row deleted … }
 */
export const patchCard = async (
  id: string,
  body: PatchCardBody,
): Promise<{ status: 200; card: Card } | { status: 204 }> => {
  const url = `${getApiBaseUrl()}/cards/${encodeURIComponent(id)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });
  } catch (cause) {
    console.error(`[apiClient] network failure for PATCH /cards/${id}`, cause);
    throw new ApiError({
      message: 'Network unavailable',
      status: null,
      kind: 'NETWORK_OFFLINE',
      cause,
    });
  }

  if (!response.ok) {
    const errBody = await parseJsonSafely(response);
    console.error(`[apiClient] non-OK response ${response.status} for PATCH /cards/${id}`, errBody);
    throw new ApiError({
      message: `Request failed with status ${response.status}`,
      status: response.status,
      kind: mapStatusToKind(response.status, errBody),
      cause: errBody,
    });
  }

  if (response.status === 204) return { status: 204 };

  const json = await parseJsonSafely(response);
  if (!validateCard(json)) {
    console.error('[apiClient] schema validation failed for PATCH /cards', validateCard.errors);
    throw new ApiError({
      message: 'Response failed schema validation',
      status: response.status,
      kind: 'VALIDATION_ERROR',
      cause: validateCard.errors,
    });
  }
  return { status: 200, card: json as Card };
};

export const apiClient = {
  signInWithGoogle,
  getMe,
  signOut,
  getCards,
  getCardImages,
  searchCards,
  getCardPrices,
  getCardPriceHistory,
  getCard,
  upsertCard,
  patchCard,
};

export type ApiClient = typeof apiClient;
