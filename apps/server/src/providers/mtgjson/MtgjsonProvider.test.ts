import path from 'node:path';
import { MtgjsonSDK } from 'mtgjson-sdk';
import MtgjsonProvider from './MtgjsonProvider';

// Canonical fixture: Lightning Bolt printed in Magic 2011 (M11) #149.
// Stable across MTGJSON data refreshes; verified against the local cache at
// apps/server/data/mtgjson-cache (version 5.3.0+20260515).
const M11_BOLT_UUID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';
const M11_BOLT_SCRYFALL_ID = 'e768c957-3a1f-42f5-853a-96942f645df5';

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

describe('MtgjsonProvider.searchRaw', () => {
  test('returns a page of enriched records plus a total count', async () => {
    const { cards, total } = await provider.searchRaw({ name: 'lightning bolt', set: 'M11', limit: 20 });

    expect(total).toBeGreaterThan(0);
    const m11Bolt = cards.find((r) => r.id === M11_BOLT_UUID);
    expect(m11Bolt).toBeDefined();
    expect(m11Bolt!.name).toBe('Lightning Bolt');
    expect(m11Bolt!.set).toBe('M11');
    expect(m11Bolt!.cardNumber).toBe('149');
    expect(typeof m11Bolt!.commanderLegal).toBe('boolean');
  });

  test('returns an empty page and zero total when nothing matches', async () => {
    // A bogus set code matches nothing deterministically (fuzzy name match is
    // too lenient to guarantee zero results).
    const { cards, total } = await provider.searchRaw({ set: 'ZZZ_NOT_A_REAL_SET' });
    expect(cards).toEqual([]);
    expect(total).toBe(0);
  });

  test('paginates: limit bounds the page while total stays constant across pages', async () => {
    const first = await provider.searchRaw({ name: 'bolt', limit: 5, page: 1 });
    const second = await provider.searchRaw({ name: 'bolt', limit: 5, page: 2 });

    expect(first.cards.length).toBe(5);
    expect(first.total).toBeGreaterThan(5);
    expect(first.total).toBe(second.total);
    const firstIds = new Set(first.cards.map((c) => c.id));
    expect(second.cards.some((c) => !firstIds.has(c.id))).toBe(true);
  });

  test('excludeUuids drops the excluded printing and decrements total by one', async () => {
    const base = await provider.searchRaw({ name: 'lightning bolt', set: 'M11', limit: 50 });
    expect(base.cards.some((c) => c.id === M11_BOLT_UUID)).toBe(true);

    const excluded = await provider.searchRaw(
      { name: 'lightning bolt', set: 'M11', limit: 50 },
      { excludeUuids: [M11_BOLT_UUID] },
    );
    expect(excluded.cards.some((c) => c.id === M11_BOLT_UUID)).toBe(false);
    expect(excluded.total).toBe(base.total - 1);
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
