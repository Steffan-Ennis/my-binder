// All JSON Schema constants used for Fastify runtime validation (Principle VII).
// These are the authoritative schemas — imported by route files, never redefined inline.

export const CARD_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

export const CARD_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards', 'total'],
  properties: {
    cards: {
      type: 'array',
      items: CARD_RESPONSE_SCHEMA,
    },
    total: { type: 'integer', minimum: 0 },
  },
} as const;

export const CREATE_CARD_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
  },
} as const;

export const UPDATE_CARD_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
  },
} as const;

export const CARD_ID_PARAMS_SCHEMA = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
} as const;

export const HEALTH_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'database'],
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    database: { type: 'string', enum: ['connected', 'unavailable'] },
  },
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'message'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
} as const;
