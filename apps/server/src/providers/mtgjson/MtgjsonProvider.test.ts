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
