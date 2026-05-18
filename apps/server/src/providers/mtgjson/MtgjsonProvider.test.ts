import path from 'node:path';
import { MtgjsonSDK } from 'mtgjson-sdk';
import MtgjsonProvider from './MtgjsonProvider';

// Canonical fixture: Lightning Bolt printed in Magic 2011 (M11) #149.
// Stable across MTGJSON data refreshes; verified against the local cache at
// apps/server/data/mtgjson-cache (version 5.3.0+20260515).
const M11_BOLT_UUID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';
const M11_BOLT_SCRYFALL_ID = 'e768c957-3a1f-42f5-853a-96942f645df5';
const M11_BOLT_IMAGE_REF = `https://cards.scryfall.io/normal/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`;

// A UUID that intentionally does not exist in the dataset — used to drive the
// "unknown UUID" branches of getByUuid and getCardImages.
const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

const CACHE_DIR = path.resolve(__dirname, '../../../data/mtgjson-cache');

let sdk: MtgjsonSDK;
let provider: MtgjsonProvider;

beforeAll(async () => {
  sdk = await MtgjsonSDK.create({ cacheDir: CACHE_DIR, offline: true });
  provider = new MtgjsonProvider(sdk);
});

afterAll(async () => {
  await sdk.close();
});

describe('MtgjsonProvider.search', () => {
  test('returns enriched CardRecords with scryfall-derived imageRef and commanderLegal', async () => {
    const results = await provider.search({ name: 'lightning bolt', set: 'M11' });

    const m11Bolt = results.find((r) => r.id === M11_BOLT_UUID);
    expect(m11Bolt).toBeDefined();
    expect(m11Bolt!.name).toBe('Lightning Bolt');
    expect(m11Bolt!.set).toBe('M11');
    expect(m11Bolt!.cardNumber).toBe('149');
    expect(m11Bolt!.imageRef).toBe(M11_BOLT_IMAGE_REF);
    expect(m11Bolt!.commanderLegal).toBe(true);
  });

  test('returns empty array when search yields no cards', async () => {
    const results = await provider.search({ name: 'definitely-not-a-real-card-xyzzy' });
    expect(results).toEqual([]);
  });

  test('every returned record has a boolean commanderLegal field', async () => {
    const results = await provider.search({ name: 'lightning bolt', set: 'M11' });
    expect(results.length).toBeGreaterThan(0);
    for (const record of results) {
      expect(typeof record.commanderLegal).toBe('boolean');
    }
  });
});

describe('MtgjsonProvider.getByUuid', () => {
  test('returns CardDetails populated from sdk.cards + identifiers + sets', async () => {
    const details = await provider.getByUuid(M11_BOLT_UUID);

    expect(details).toEqual({
      uuid: M11_BOLT_UUID,
      name: 'Lightning Bolt',
      setCode: 'M11',
      setName: 'Magic 2011',
      cardNumber: '149',
      typeLine: 'Instant',
      scryfallId: M11_BOLT_SCRYFALL_ID,
    });
  });

  test('returns null when the UUID is unknown', async () => {
    const details = await provider.getByUuid(UNKNOWN_UUID);
    expect(details).toBeNull();
  });
});

describe('MtgjsonProvider.getCardImages', () => {
  test('returns small/medium/large URLs for a known uuid with a scryfall id', async () => {
    const images = await provider.getCardImages(M11_BOLT_UUID);

    expect(images).toEqual({
      small: `https://cards.scryfall.io/small/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`,
      medium: `https://cards.scryfall.io/normal/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`,
      large: `https://cards.scryfall.io/large/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`,
    });
  });

  test('returns null when the UUID is unknown', async () => {
    const images = await provider.getCardImages(UNKNOWN_UUID);
    expect(images).toBeNull();
  });
});

// ─── Spec 018 / FR-005, FR-021 — catalogue filter dimensions ──────────────
// These tests stub `sdk.cards.search` so we can assert deterministic input/output
// behaviour for the new filter dimensions without depending on the offline cache
// containing exhaustive coverage. The provider's enrichment chain
// (identifiers + legalities) is also stubbed because we only care about the
// filtering contract here.

type MutableCardSet = {
  uuid: string;
  name: string;
  setCode: string;
  number: string;
  manaCost?: string;
  colorIdentity: string[];
  availability: string[];
  supertypes: string[];
  subtypes: string[];
  types: string[];
  legalities: Record<string, string>;
};

const makeCard = (overrides: Partial<MutableCardSet> = {}): MutableCardSet => ({
  uuid: '00000000-0000-0000-0000-000000000001',
  name: 'Test Card',
  setCode: 'TST',
  number: '1',
  manaCost: '{1}',
  colorIdentity: [],
  availability: ['paper'],
  supertypes: [],
  subtypes: [],
  types: ['Creature'],
  legalities: {},
  ...overrides,
});

const stubProvider = (cards: ReadonlyArray<MutableCardSet>): {
  provider: MtgjsonProvider;
  searchSpy: jest.Mock;
} => {
  const searchSpy = jest.fn(async () => cards);
  const fakeSdk = {
    cards: { search: searchSpy },
    identifiers: { getIdentifiers: async () => ({ scryfallId: null }) },
    legalities: { isLegal: async () => true },
  };
  return {
    provider: new MtgjsonProvider(fakeSdk as unknown as MtgjsonSDK),
    searchSpy,
  };
};

describe('MtgjsonProvider.search — paper-only filter (FR-021)', () => {
  test('excludes printings whose availability does not include "paper"', async () => {
    const { provider } = stubProvider([
      makeCard({ uuid: 'aaaaaaaa-0000-0000-0000-000000000001', availability: ['paper'] }),
      makeCard({ uuid: 'aaaaaaaa-0000-0000-0000-000000000002', availability: ['mtgo'] }),
      makeCard({ uuid: 'aaaaaaaa-0000-0000-0000-000000000003', availability: ['paper', 'arena'] }),
    ]);

    const results = await provider.search({ name: 'anything' });

    const ids = results.map((r) => r.id);
    expect(ids).toContain('aaaaaaaa-0000-0000-0000-000000000001');
    expect(ids).toContain('aaaaaaaa-0000-0000-0000-000000000003');
    expect(ids).not.toContain('aaaaaaaa-0000-0000-0000-000000000002');
  });
});

describe('MtgjsonProvider.search — format filter (FR-005)', () => {
  test('only returns printings legal in at least one requested format (OR-within-dimension)', async () => {
    const { provider } = stubProvider([
      makeCard({
        uuid: 'bbbbbbbb-0000-0000-0000-000000000001',
        legalities: { modern: 'Legal', legacy: 'Banned' },
      }),
      makeCard({
        uuid: 'bbbbbbbb-0000-0000-0000-000000000002',
        legalities: { modern: 'Banned', legacy: 'Legal' },
      }),
      makeCard({
        uuid: 'bbbbbbbb-0000-0000-0000-000000000003',
        legalities: { modern: 'Banned', legacy: 'Banned' },
      }),
    ]);

    const results = await provider.search({ name: 'x', formats: ['Modern', 'Legacy'] });

    const ids = results.map((r) => r.id);
    expect(ids).toContain('bbbbbbbb-0000-0000-0000-000000000001');
    expect(ids).toContain('bbbbbbbb-0000-0000-0000-000000000002');
    expect(ids).not.toContain('bbbbbbbb-0000-0000-0000-000000000003');
  });

  test('treats absent legality entries as not legal', async () => {
    const { provider } = stubProvider([
      makeCard({ uuid: 'cccccccc-0000-0000-0000-000000000001', legalities: {} }),
    ]);

    const results = await provider.search({ name: 'x', formats: ['Standard'] });
    expect(results).toEqual([]);
  });
});

describe('MtgjsonProvider.search — super/sub/creature type filters (FR-005)', () => {
  test('superTypes: keeps printings whose supertypes intersect (OR-within-dimension)', async () => {
    const { provider } = stubProvider([
      makeCard({ uuid: 'dddddddd-0000-0000-0000-000000000001', supertypes: ['Legendary'] }),
      makeCard({ uuid: 'dddddddd-0000-0000-0000-000000000002', supertypes: ['Basic'] }),
      makeCard({ uuid: 'dddddddd-0000-0000-0000-000000000003', supertypes: [] }),
    ]);

    const results = await provider.search({ name: 'x', superTypes: ['Legendary'] });

    expect(results.map((r) => r.id)).toEqual(['dddddddd-0000-0000-0000-000000000001']);
  });

  test('subTypes: keeps printings whose subtypes intersect', async () => {
    const { provider } = stubProvider([
      makeCard({ uuid: 'eeeeeeee-0000-0000-0000-000000000001', subtypes: ['Equipment'] }),
      makeCard({ uuid: 'eeeeeeee-0000-0000-0000-000000000002', subtypes: ['Aura'] }),
    ]);

    const results = await provider.search({ name: 'x', subTypes: ['Equipment'] });

    expect(results.map((r) => r.id)).toEqual(['eeeeeeee-0000-0000-0000-000000000001']);
  });

  test('creatureTypes: keeps only Creatures whose subtypes intersect with the requested set', async () => {
    const { provider } = stubProvider([
      makeCard({
        uuid: 'ffffffff-0000-0000-0000-000000000001',
        types: ['Creature'],
        subtypes: ['Elf', 'Warrior'],
      }),
      makeCard({
        uuid: 'ffffffff-0000-0000-0000-000000000002',
        types: ['Creature'],
        subtypes: ['Goblin'],
      }),
      makeCard({
        uuid: 'ffffffff-0000-0000-0000-000000000003',
        types: ['Sorcery'],
        subtypes: ['Elf'],
      }),
    ]);

    const results = await provider.search({ name: 'x', creatureTypes: ['Elf'] });

    expect(results.map((r) => r.id)).toEqual(['ffffffff-0000-0000-0000-000000000001']);
  });

  test('AND-across-dimensions: a card must satisfy every supplied dimension', async () => {
    const { provider } = stubProvider([
      makeCard({
        uuid: 'aaaa1111-0000-0000-0000-000000000001',
        supertypes: ['Legendary'],
        subtypes: ['Elf'],
        types: ['Creature'],
        legalities: { modern: 'Legal' },
      }),
      makeCard({
        uuid: 'aaaa1111-0000-0000-0000-000000000002',
        supertypes: ['Legendary'],
        subtypes: ['Goblin'],
        types: ['Creature'],
        legalities: { modern: 'Legal' },
      }),
    ]);

    const results = await provider.search({
      name: 'x',
      formats: ['Modern'],
      superTypes: ['Legendary'],
      creatureTypes: ['Elf'],
    });

    expect(results.map((r) => r.id)).toEqual(['aaaa1111-0000-0000-0000-000000000001']);
  });
});
