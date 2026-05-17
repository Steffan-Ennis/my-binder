// Mobile-specific Ajv schemas. The mobile app validates inbound API responses
// against these inside the TanStack queryFn before resolving (Principle VII).
//
// Schema-of-record rule (spec 016): `Card` and `CardList` are defined ONCE in
// `@my-binder/core` and consumed by both `apps/server` and `apps/mobile`. The
// previously-local mobile declarations have been replaced with re-exports from
// core. Only auth-related schemas remain local to the mobile app pending a
// follow-up migration.

export {
  CARD_RESPONSE_SCHEMA as CARD_SCHEMA,
  CARD_RESPONSE_SCHEMA,
  CARD_LIST_RESPONSE_SCHEMA,
  CARD_IMAGES_RESPONSE_SCHEMA,
  CARD_PRICES_RESPONSE_SCHEMA,
  CARD_PRICE_HISTORY_RESPONSE_SCHEMA,
  SEARCH_RESULT_SCHEMA,
} from '@my-binder/core';
export type {
  Card,
  CardImages,
  CardList as CardListResponse,
  CardPriceHistoryResponse,
  CardPricesResponse,
  CardRecord,
  PatchCardBody,
  PriceQuote,
  SearchQuery,
  SearchResult,
} from '@my-binder/core';

export const AUTH_USER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'email'],
  properties: {
    id: { type: 'string', minLength: 1 },
    email: { type: 'string', minLength: 1 },
    displayName: { type: 'string' },
  },
} as const;

export const GOOGLE_SIGN_IN_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['user'],
  properties: {
    user: AUTH_USER_SCHEMA,
    token: { type: 'string', minLength: 1 },
    session: {
      type: 'object',
      additionalProperties: true,
      required: ['jwt'],
      properties: {
        jwt: { type: 'string', minLength: 1 },
        expiresAt: { type: 'string' },
      },
    },
  },
} as const;

export const AUTH_ME_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['user'],
  properties: {
    user: AUTH_USER_SCHEMA,
  },
} as const;

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
};

export type GoogleSignInResponse = {
  user: AuthUser;
  token?: string;
  session?: {
    jwt: string;
    expiresAt?: string;
  };
};

export type AuthMeResponse = {
  user: AuthUser;
};