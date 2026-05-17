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
    setName: { type: 'string' },
    setCode: { type: 'string' },
    typeLine: { type: 'string' },
    // Spec 018 / FR-023 — owned-count per (id, userId). minimum: 0 here so the
    // catalogue path (which COALESCEs missing rows to 0) validates against
    // the same schema as /cards; the DB-layer CHECK >= 1 enforces the binder
    // invariant separately.
    numberOwned: { type: 'integer', minimum: 0 },
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

export const CARD_IMAGES_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['small', 'medium', 'large'],
  properties: {
    small: { type: 'string', minLength: 1 },
    medium: { type: 'string', minLength: 1 },
    large: { type: 'string', minLength: 1 },
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
    id: { type: 'string' },
    name: { type: 'string' },
    set: { type: 'string' },
    cardNumber: { type: 'string' },
    manaCost: { type: ['string', 'null'] },
    colorIdentity: { type: 'array', items: { type: 'string' } },
    commanderLegal: { type: 'boolean' },
    imageRef: { type: ['string', 'null'] },
    // Spec 018 / FR-024 — owned-count joined per row when the caller is
    // authenticated; absent (or 0) otherwise.
    numberOwned: { type: 'integer', minimum: 0 },
  },
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
    // Spec 018 / FR-005 — catalogue filter dimensions. Comma-separated lists
    // of free-form strings parsed into `string[]` by the route handler;
    // whitespace around tokens is trimmed and empty tokens are dropped.
    formats: { type: 'string' },
    super_types: { type: 'string' },
    sub_types: { type: 'string' },
    creature_types: { type: 'string' },
    // FR-005 clarification — restricts results to printings the user does NOT
    // own. Requires an authenticated request; the route returns 401 if set on
    // an anonymous call.
    missing_only: { type: 'boolean' },
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

// ─── Spec 018 — price + mutation schemas (FR-017, FR-018, FR-019, FR-028) ──

// Latest observation per source. Either `null` (no observation for the
// (printing, source) pair) or an object with the four required fields.
export const PRICE_QUOTE_SCHEMA = {
  oneOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'amountCents', 'currency', 'observedOn'],
      properties: {
        source: { type: 'string', enum: ['CARD_KINGDOM', 'TCG_PLAYER'] },
        amountCents: { type: 'integer', minimum: 0 },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
        observedOn: { type: 'string', format: 'date' },
      },
    },
  ],
} as const;

export const CARD_PRICES_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['printingId', 'cardKingdom', 'tcgPlayer'],
  properties: {
    printingId: { type: 'string', format: 'uuid' },
    cardKingdom: PRICE_QUOTE_SCHEMA,
    tcgPlayer: PRICE_QUOTE_SCHEMA,
  },
} as const;

export const PRICE_POINT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['observedOn', 'amountCents'],
  properties: {
    observedOn: { type: 'string', format: 'date' },
    amountCents: { type: 'integer', minimum: 0 },
  },
} as const;

export const CARD_PRICE_HISTORY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['printingId', 'days', 'cardKingdom', 'tcgPlayer'],
  properties: {
    printingId: { type: 'string', format: 'uuid' },
    days: { type: 'integer', minimum: 1, maximum: 365 },
    cardKingdom: { type: 'array', items: PRICE_POINT_SCHEMA },
    tcgPlayer: { type: 'array', items: PRICE_POINT_SCHEMA },
  },
} as const;

// FR-028 — PATCH /cards/:id body. `delta` is a hard-pinned enum so the
// route handler need not re-validate the absolute value.
export const PATCH_CARD_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['delta'],
  properties: {
    delta: { type: 'integer', enum: [1, -1] },
  },
} as const;
