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

// One SDK price row as the offline parquet would yield it (loosely typed —
// see PriceQuery in mtgjson-sdk). `source` is the price *format* (paper vs
// mtgo); `provider` is the marketplace; `price` is in dollars.
type PriceRow = Record<string, unknown>;
const priceRow = (over: Partial<Record<string, unknown>> = {}): PriceRow => ({
  uuid: M11_BOLT_UUID,
  source: 'paper',
  provider: 'cardkingdom',
  price_type: 'retail',
  finish: 'normal',
  date: '2026-05-22',
  price: 17.23,
  currency: 'USD',
  ...over,
});

describe('MtgjsonProvider', () => {
  let sdk: MtgjsonSDK;
  let provider: MtgjsonProvider;

  beforeAll(async () => {
    sdk = await MtgjsonSDK.create({ cacheDir: CACHE_DIR, offline: true });
    provider = new MtgjsonProvider(sdk);
  });

  afterAll(async () => {
    await sdk.close();
  });

  describe('.searchRaw', () => {
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

  describe('.getByUuid', () => {
    test('returns CardDetails populated from sdk.cards + identifiers + sets', async () => {
      const details = await provider.getByUuid(M11_BOLT_UUID);

      expect(details).toEqual({
        uuid: M11_BOLT_UUID,
        name: 'Lightning Bolt',
        setCode: 'M11',
        setName: 'Magic 2011',
        cardNumber: '149',
        typeLine: 'Instant',
        oracle: 'Lightning Bolt deals 3 damage to any target.',
        scryfallId: M11_BOLT_SCRYFALL_ID,
      });
    });

    test('returns null when the UUID is unknown', async () => {
      const details = await provider.getByUuid(UNKNOWN_UUID);
      expect(details).toBeNull();
    });
  });

  describe('.getCardImages', () => {
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

  // Spec 020 — price methods. The offline cache holds no price parquets, so
  // the SDK price query layer is spied (per the spec's mock-the-SDK decision);
  // these tests verify the SDK-row → wire mapping the provider owns.
  describe('.getPrices', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns the latest paper-retail observation per source as cents', async () => {
      const today = jest.spyOn(sdk.prices, 'today').mockImplementation(async (uuid, options) => {
        if (options?.provider === 'cardkingdom') {
          return [priceRow({ uuid, provider: 'cardkingdom', price: 17.23 })];
        }
        if (options?.provider === 'tcgplayer') {
          return [priceRow({ uuid, provider: 'tcgplayer', price: 16.38 })];
        }
        return [];
      });

      const result = await provider.getPrices(M11_BOLT_UUID);

      expect(result).toEqual({
        printingId: M11_BOLT_UUID,
        cardKingdom: { source: 'CARD_KINGDOM', amountCents: 1723, currency: 'USD', observedOn: '2026-05-22' },
        tcgPlayer: { source: 'TCG_PLAYER', amountCents: 1638, currency: 'USD', observedOn: '2026-05-22' },
      });
      // normal finish + retail price type are requested per source.
      expect(today).toHaveBeenCalledWith(
        M11_BOLT_UUID,
        expect.objectContaining({ provider: 'cardkingdom', finish: 'normal', priceType: 'retail' }),
      );
      expect(today).toHaveBeenCalledWith(
        M11_BOLT_UUID,
        expect.objectContaining({ provider: 'tcgplayer', finish: 'normal', priceType: 'retail' }),
      );
    });

    test('yields null for a source with no observation (FR-004)', async () => {
      jest.spyOn(sdk.prices, 'today').mockImplementation(async (uuid, options) =>
        options?.provider === 'cardkingdom' ? [priceRow({ uuid })] : [],
      );

      const result = await provider.getPrices(M11_BOLT_UUID);

      expect(result.cardKingdom).not.toBeNull();
      expect(result.tcgPlayer).toBeNull();
    });

    test('excludes digital (non-paper) observations — physical only (FR-006)', async () => {
      jest.spyOn(sdk.prices, 'today').mockImplementation(async (uuid, options) =>
        options?.provider === 'cardkingdom'
          ? [priceRow({ uuid, source: 'mtgo', price: 99.99 })]
          : [],
      );

      const result = await provider.getPrices(M11_BOLT_UUID);

      expect(result.cardKingdom).toBeNull();
      expect(result.tcgPlayer).toBeNull();
    });
  });

  describe('.getPriceHistory', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns each source series over the window, cents-converted', async () => {
      const history = jest.spyOn(sdk.prices, 'history').mockImplementation(async (uuid, options) => {
        if (options?.provider === 'cardkingdom') {
          return [
            priceRow({ uuid, provider: 'cardkingdom', date: '2026-05-20', price: 16.99 }),
            priceRow({ uuid, provider: 'cardkingdom', date: '2026-05-21', price: 17.1 }),
          ];
        }
        if (options?.provider === 'tcgplayer') {
          return [priceRow({ uuid, provider: 'tcgplayer', date: '2026-05-20', price: 16.1 })];
        }
        return [];
      });

      const result = await provider.getPriceHistory(M11_BOLT_UUID, 30);

      expect(result.printingId).toBe(M11_BOLT_UUID);
      expect(result.days).toBe(30);
      expect(result.cardKingdom).toEqual([
        { observedOn: '2026-05-20', amountCents: 1699 },
        { observedOn: '2026-05-21', amountCents: 1710 },
      ]);
      expect(result.tcgPlayer).toEqual([{ observedOn: '2026-05-20', amountCents: 1610 }]);
      // The window is passed to the SDK as a date range over `days`.
      expect(history).toHaveBeenCalledWith(
        M11_BOLT_UUID,
        expect.objectContaining({
          provider: 'cardkingdom',
          finish: 'normal',
          priceType: 'retail',
          dateFrom: expect.any(String),
          dateTo: expect.any(String),
        }),
      );
    });

    test('drops non-paper points and returns [] when a source has no paper data', async () => {
      jest.spyOn(sdk.prices, 'history').mockImplementation(async (uuid, options) =>
        options?.provider === 'cardkingdom'
          ? [priceRow({ uuid, source: 'mtgo', date: '2026-05-20', price: 99 })]
          : [],
      );

      const result = await provider.getPriceHistory(M11_BOLT_UUID, 30);

      expect(result.cardKingdom).toEqual([]);
      expect(result.tcgPlayer).toEqual([]);
    });
  });
});
