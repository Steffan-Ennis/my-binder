import type { CardSet } from 'mtgjson-sdk';
import mapCardSetToCardRecord from './mapper';

// Minimal factory — only sets fields used by the mapper; rest are typed-cast.
// Note: legalities and identifiers are NOT set here — they live in separate Parquet
// files and are never populated by the SDK's card queries. Enrichment is passed
// explicitly as the second argument to mapCardSetToCardRecord.
function makeCard(overrides: Partial<Record<string, unknown>> = {}): CardSet {
  return {
    name: 'Lightning Bolt',
    setCode: 'M11',
    number: '149',
    manaCost: '{R}',
    colorIdentity: ['R'],
    availability: ['paper'],
    borderColor: 'black',
    colors: ['R'],
    convertedManaCost: 1,
    finishes: [],
    frameVersion: '2015',
    language: 'English',
    layout: 'normal',
    manaValue: 1,
    purchaseUrls: {},
    rarity: 'common',
    subtypes: [],
    supertypes: [],
    type: 'Instant',
    types: ['Instant'],
    uuid: '00000000-0000-0000-0000-000000000000',
    ...overrides,
  } as unknown as CardSet;
}

describe('mapCardSetToCardRecord', () => {
  test('maps standard card fields correctly with enrichment', () => {
    const card = makeCard();
    const record = mapCardSetToCardRecord(card, {
      commanderLegal: true,
      scryfallId: 'e3285fd6-0000-0000-0000-example00001',
    });
    expect(record.name).toBe('Lightning Bolt');
    expect(record.set).toBe('M11');
    expect(record.cardNumber).toBe('149');
    expect(record.manaCost).toBe('{R}');
    expect(record.colorIdentity).toEqual(['R']);
    expect(record.commanderLegal).toBe(true);
    expect(record.imageRef).toBe('e3285fd6-0000-0000-0000-example00001');
  });

  test('commanderLegal and imageRef are undefined when no enrichment is passed', () => {
    const card = makeCard();
    const record = mapCardSetToCardRecord(card);
    expect(record.commanderLegal).toBeUndefined();
    expect(record.imageRef).toBeNull();
  });

  test('manaCost is null when card has no mana cost (land)', () => {
    const card = makeCard({ manaCost: undefined });
    const record = mapCardSetToCardRecord(card);
    expect(record.manaCost).toBeNull();
  });

  test('imageRef is null when scryfallId is absent in enrichment', () => {
    const record = mapCardSetToCardRecord(makeCard(), { scryfallId: null });
    expect(record.imageRef).toBeNull();
  });

  test('commanderLegal is false when enrichment says banned', () => {
    const record = mapCardSetToCardRecord(makeCard(), { commanderLegal: false });
    expect(record.commanderLegal).toBe(false);
  });

  test('colorIdentity is empty array for colourless cards', () => {
    const card = makeCard({ colorIdentity: [] });
    const record = mapCardSetToCardRecord(card);
    expect(record.colorIdentity).toEqual([]);
  });
});
