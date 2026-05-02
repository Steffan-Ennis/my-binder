// Mobile-specific Ajv schemas. The mobile app validates inbound API responses
// against these inside the TanStack queryFn before resolving (Principle VII).
//
// Per `specs/002-mobile-binder-app/contracts/api-client.md`, the mobile contract
// is forward-looking — `frontFaceImageUrl` and the cursor-paginated list shape
// haven't yet landed in `@my-binder/core/schemas/`. When they do, swap the
// schemas here for the core re-exports and delete this file.

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

export const CARD_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'name', 'frontFaceImageUrl'],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    frontFaceImageUrl: { type: 'string', minLength: 1 },
  },
} as const;

export const CARD_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['cards'],
  properties: {
    cards: { type: 'array', items: CARD_SCHEMA },
    nextCursor: { type: ['string', 'null'] },
  },
} as const;

export type Card = {
  id: string;
  name: string;
  frontFaceImageUrl: string;
};

export type CardListResponse = {
  cards: Card[];
  nextCursor: string | null;
};

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