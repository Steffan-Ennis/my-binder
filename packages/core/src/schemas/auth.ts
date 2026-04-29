// Auth JSON Schema constants for Fastify runtime validation (Principle VII).
// These are the authoritative schemas — imported by route files, never redefined inline.

export const AUTH_USER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'email', 'displayName'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    displayName: { type: 'string' },
    avatarUrl: { type: ['string', 'null'] },
  },
} as const;

export const GOOGLE_SIGN_IN_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['idToken'],
  properties: {
    idToken: { type: 'string', minLength: 1 },
  },
} as const;

export const GOOGLE_SIGN_IN_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['token', 'user'],
  properties: {
    token: { type: 'string' },
    user: AUTH_USER_SCHEMA,
  },
} as const;

export const AUTH_ME_RESPONSE_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'user'],
      properties: {
        kind: { type: 'string', enum: ['authenticated'] },
        user: AUTH_USER_SCHEMA,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind'],
      properties: {
        kind: { type: 'string', enum: ['guest'] },
      },
    },
  ],
} as const;

export const AUTH_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
  },
} as const;
