import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {
  CARD_PRICES_RESPONSE_SCHEMA,
  CARD_PRICE_HISTORY_RESPONSE_SCHEMA,
  CARD_RECORD_SCHEMA,
  CARD_RESPONSE_SCHEMA,
  PATCH_CARD_BODY_SCHEMA,
  PRICE_POINT_SCHEMA,
  PRICE_QUOTE_SCHEMA,
  SEARCH_QUERYSTRING_SCHEMA,
} from './card';

// Spec 018 — schema tests. Co-located with the schema definitions per
// Principle III. The Ajv instance below mirrors the server-side runtime
// config so tests assert the same validation behaviour Fastify will exercise
// at request time.

const ajv = new Ajv({ allErrors: true, coerceTypes: false, useDefaults: false });
addFormats(ajv);

// Cast the `as const` schemas through `unknown` so ajv.compile accepts them.
const compile = (schema: unknown) => ajv.compile(schema as Parameters<typeof ajv.compile>[0]);

const baseCardResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Lightning Bolt',
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
};

const baseCardRecord = {
  name: 'Lightning Bolt',
  set: 'M11',
  cardNumber: '146',
  manaCost: '{R}',
  colorIdentity: ['R'],
};

const validUuid = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';

describe('CARD_RESPONSE_SCHEMA — numberOwned (spec 018 / FR-023)', () => {
  const validate = compile(CARD_RESPONSE_SCHEMA);

  it('accepts a card with numberOwned >= 0', () => {
    expect(validate({ ...baseCardResponse, numberOwned: 3 })).toBe(true);
    expect(validate({ ...baseCardResponse, numberOwned: 0 })).toBe(true);
  });

  it('rejects a non-integer numberOwned', () => {
    expect(validate({ ...baseCardResponse, numberOwned: 1.5 })).toBe(false);
  });

  it('rejects a negative numberOwned', () => {
    expect(validate({ ...baseCardResponse, numberOwned: -1 })).toBe(false);
  });
});

describe('CARD_RECORD_SCHEMA — numberOwned (spec 018 / FR-024)', () => {
  const validate = compile(CARD_RECORD_SCHEMA);

  it('accepts a record carrying numberOwned >= 0', () => {
    expect(validate({ ...baseCardRecord, numberOwned: 2 })).toBe(true);
    expect(validate({ ...baseCardRecord, numberOwned: 0 })).toBe(true);
  });

  it('still accepts a record without numberOwned (unauthenticated path)', () => {
    expect(validate(baseCardRecord)).toBe(true);
  });

  it('rejects a negative numberOwned', () => {
    expect(validate({ ...baseCardRecord, numberOwned: -5 })).toBe(false);
  });
});

describe('SEARCH_QUERYSTRING_SCHEMA — catalogue filter dimensions (FR-005)', () => {
  const validate = compile(SEARCH_QUERYSTRING_SCHEMA);

  it('accepts comma-separated formats', () => {
    expect(validate({ formats: 'Modern,Legacy' })).toBe(true);
  });

  it('accepts comma-separated super_types', () => {
    expect(validate({ super_types: 'Legendary,Basic' })).toBe(true);
  });

  it('accepts comma-separated sub_types', () => {
    expect(validate({ sub_types: 'Equipment,Aura' })).toBe(true);
  });

  it('accepts comma-separated creature_types', () => {
    expect(validate({ creature_types: 'Elf,Goblin' })).toBe(true);
  });

  it('accepts missing_only boolean', () => {
    expect(validate({ missing_only: true })).toBe(true);
  });

  it('rejects unknown additional properties', () => {
    expect(validate({ unknown_filter: 'x' })).toBe(false);
  });
});

describe('PRICE_QUOTE_SCHEMA — accepts null OR a quote object (FR-019)', () => {
  const validate = compile(PRICE_QUOTE_SCHEMA);

  it('accepts null (no observation)', () => {
    expect(validate(null)).toBe(true);
  });

  it('accepts a fully-populated quote', () => {
    expect(
      validate({
        source: 'CARD_KINGDOM',
        amountCents: 1378,
        currency: 'USD',
        observedOn: '2026-05-18',
      }),
    ).toBe(true);
  });

  it('rejects a source other than CARD_KINGDOM | TCG_PLAYER', () => {
    expect(
      validate({
        source: 'MTG_GOLDFISH',
        amountCents: 1378,
        currency: 'USD',
        observedOn: '2026-05-18',
      }),
    ).toBe(false);
  });

  it('rejects a negative amountCents', () => {
    expect(
      validate({
        source: 'TCG_PLAYER',
        amountCents: -100,
        currency: 'USD',
        observedOn: '2026-05-18',
      }),
    ).toBe(false);
  });
});

describe('CARD_PRICES_RESPONSE_SCHEMA — both source slots required (FR-017)', () => {
  const validate = compile(CARD_PRICES_RESPONSE_SCHEMA);

  it('accepts a response with both slots populated', () => {
    expect(
      validate({
        printingId: validUuid,
        cardKingdom: {
          source: 'CARD_KINGDOM',
          amountCents: 1378,
          currency: 'USD',
          observedOn: '2026-05-18',
        },
        tcgPlayer: {
          source: 'TCG_PLAYER',
          amountCents: 1311,
          currency: 'USD',
          observedOn: '2026-05-18',
        },
      }),
    ).toBe(true);
  });

  it('accepts a response with both slots null (no observations)', () => {
    expect(
      validate({ printingId: validUuid, cardKingdom: null, tcgPlayer: null }),
    ).toBe(true);
  });

  it('rejects a response missing cardKingdom', () => {
    expect(validate({ printingId: validUuid, tcgPlayer: null })).toBe(false);
  });

  it('rejects a response missing tcgPlayer', () => {
    expect(validate({ printingId: validUuid, cardKingdom: null })).toBe(false);
  });
});

describe('CARD_PRICE_HISTORY_RESPONSE_SCHEMA — per-source arrays (FR-018)', () => {
  const validate = compile(CARD_PRICE_HISTORY_RESPONSE_SCHEMA);

  it('accepts both empty arrays (no recent observations)', () => {
    expect(
      validate({ printingId: validUuid, days: 30, cardKingdom: [], tcgPlayer: [] }),
    ).toBe(true);
  });

  it('accepts populated arrays', () => {
    expect(
      validate({
        printingId: validUuid,
        days: 30,
        cardKingdom: [{ observedOn: '2026-05-18', amountCents: 1378 }],
        tcgPlayer: [{ observedOn: '2026-05-18', amountCents: 1311 }],
      }),
    ).toBe(true);
  });

  it('rejects a days value outside 1..365', () => {
    expect(
      validate({ printingId: validUuid, days: 0, cardKingdom: [], tcgPlayer: [] }),
    ).toBe(false);
    expect(
      validate({ printingId: validUuid, days: 400, cardKingdom: [], tcgPlayer: [] }),
    ).toBe(false);
  });
});

describe('PRICE_POINT_SCHEMA', () => {
  const validate = compile(PRICE_POINT_SCHEMA);

  it('accepts a well-formed observation', () => {
    expect(validate({ observedOn: '2026-05-18', amountCents: 1378 })).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(validate({ observedOn: '2026-05-18' })).toBe(false);
    expect(validate({ amountCents: 1378 })).toBe(false);
  });
});

describe('PATCH_CARD_BODY_SCHEMA — delta enum (FR-028)', () => {
  const validate = compile(PATCH_CARD_BODY_SCHEMA);

  it('accepts delta = 1', () => {
    expect(validate({ delta: 1 })).toBe(true);
  });

  it('accepts delta = -1', () => {
    expect(validate({ delta: -1 })).toBe(true);
  });

  it.each([0, 2, -2, 100, -100])('rejects delta = %s', (delta) => {
    expect(validate({ delta })).toBe(false);
  });

  it('rejects a missing delta', () => {
    expect(validate({})).toBe(false);
  });

  it('rejects extra properties', () => {
    expect(validate({ delta: 1, foo: 'bar' })).toBe(false);
  });
});
