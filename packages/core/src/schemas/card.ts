// All JSON Schema constants used for Fastify runtime validation (Principle VII).
// These are the authoritative schemas — imported by route files, never redefined inline.

export const CARD_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    // Optional binder-home fields (spec 016) — not yet returned by the server.
    frontFaceImageUrl: { type: 'string', minLength: 1 },
    setName: { type: 'string' },
    setCode: { type: 'string' },
    typeLine: { type: 'string' },
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
    nextCursor: { type: ['string', 'null'] },
  },
} as const;

export const CREATE_CARD_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
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

// ─── Provider layer schemas (spec 004) ───────────────────────────────────────

export const CARD_RECORD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'set', 'cardNumber', 'manaCost', 'colorIdentity'],
  properties: {
    name: { type: 'string' },
    set: { type: 'string' },
    cardNumber: { type: 'string' },
    manaCost: { type: ['string', 'null'] },
    colorIdentity: { type: 'array', items: { type: 'string' } },
    commanderLegal: { type: 'boolean' },
    imageRef: { type: ['string', 'null'] },
  },
} as const;

// Lookup: union response (found=true → cards array; found=false → name string).
// Uses a permissive union-compatible schema — strict typing is enforced in TypeScript.
export const LOOKUP_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['found'],
  properties: {
    found: { type: 'boolean' },
    cards: { type: 'array', items: CARD_RECORD_SCHEMA },
    name: { type: 'string' },
  },
} as const;

export const LOOKUP_QUERYSTRING_SCHEMA = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
    fuzzy: { type: 'boolean', default: true },
    set: { type: 'string' },
    number: { type: 'string' },
  },
  additionalProperties: false,
} as const;

export const LEGALITY_QUERYSTRING_SCHEMA = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
    commander_colors: { type: 'string' },
  },
  additionalProperties: false,
} as const;

export const LEGALITY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cardName', 'legal', 'reason', 'colorIdentity'],
  properties: {
    cardName: { type: 'string' },
    legal: { type: 'boolean' },
    reason: { type: ['string', 'null'] },
    colorIdentity: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const SEARCH_QUERYSTRING_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    set: { type: 'string' },
    colors: { type: 'string' },
    cmc_min: { type: 'integer', minimum: 0 },
    cmc_max: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  additionalProperties: false,
} as const;

export const SEARCH_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards', 'total', 'page', 'limit', 'totalPages'],
  properties: {
    cards: { type: 'array', items: CARD_RECORD_SCHEMA },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
    totalPages: { type: 'integer', minimum: 0 },
  },
} as const;

export const PROVIDER_INFO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'active', 'reachable'],
  properties: {
    name: { type: 'string' },
    active: { type: 'boolean' },
    reachable: { type: 'boolean' },
  },
} as const;

export const SWITCH_PROVIDER_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
  },
} as const;
