import type { DataSource } from 'typeorm';

import type { CardProvider } from '@src/providers/interface';
import { registry } from '@src/providers/registry';
import {
  checkCommanderLegality,
  searchCards,
  getCards,
  getCard,
  createCard,
  deleteCard,
  getCardImagesById,
  NotFoundError,
  CardNotFoundError,
  ProviderUnavailableError,
} from './cardService';
import type { CardImages, CardRecord, SearchQuery } from '@my-binder/core';

import { connectTestDatabase, disconnectTestDatabase } from '@root/testing/testDatabase';
import { aUser } from '@root/testing/userEntityBuilder';
import { aCard } from '@root/testing/cardEntityBuilder';
import { CardEntity } from '@src/entities/CardEntity';
import type { UserEntity } from '@src/entities/UserEntity';

// ─── Constants ────────────────────────────────────────────────────────────────

const UUID_BOLT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_SOL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const LIGHTNING_BOLT: CardRecord = {
  id: UUID_BOLT,
  name: 'Lightning Bolt', set: 'M11', cardNumber: '149',
  manaCost: '{R}', colorIdentity: ['R'], commanderLegal: true, imageRef: null,
};
const SOL_RING: CardRecord = {
  id: UUID_SOL,
  name: 'Sol Ring', set: 'C11', cardNumber: '58',
  manaCost: '{1}', colorIdentity: [], commanderLegal: true, imageRef: null,
};

// ─── Provider helpers ─────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    searchRaw: async () => ({ cards: [LIGHTNING_BOLT, SOL_RING], total: 2 }),
    getByUuid: async () => null,
    getByUuids: async () => [],
    getCardImages: async () => null,
    getPrices: async (uuid) => ({ printingId: uuid, cardKingdom: null, tcgPlayer: null }),
    getPriceHistory: async (uuid, days) => ({ printingId: uuid, days, cardKingdom: [], tcgPlayer: [] }),
    isReachable: async () => true,
    ...overrides,
  };
}

// ─── Shared real test database ───────────────────────────────────────────────

let dataSource: DataSource;
let userA: UserEntity;
let userB: UserEntity;

beforeAll(async () => {
  dataSource = await connectTestDatabase();
  userA = await aUser().persist(dataSource);
  userB = await aUser().persist(dataSource);
});

afterAll(async () => {
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await dataSource.getRepository(CardEntity).deleteAll();
});

// ─── Collection functions ─────────────────────────────────────────────────────

describe('cardService — collection functions', () => {
  beforeAll(async () => {
    // Echo back exactly the UUIDs the service passes in, so getCards surfaces
    // one CardRecord per row the repository returned.
    registry.register('collection', makeProvider({
      getByUuids: async (uuids) =>
        uuids.map((id) => ({ ...LIGHTNING_BOLT, id, name: 'Lightning Bolt' })),
    }));
    await registry.setActive('collection');
  });

  test('getCards returns only cards for the calling user', async () => {
    await aCard().forUser(userA).withId(UUID_BOLT).withName('Lightning Bolt').persist(dataSource);
    await aCard().forUser(userB).withId(UUID_SOL).withName('Sol Ring').persist(dataSource);

    const result = await getCards(userA.id);
    expect(result.cards.length).toBe(1);
    expect(result.cards[0]?.id).toBe(UUID_BOLT);
    expect(result.total).toBe(1);
  });

  test('getCard throws NotFoundError for unknown id', async () => {
    await expect(() => getCard(UUID_BOLT, userA.id)).rejects.toThrow(NotFoundError);
  });

  test('createCard creates and returns card', async () => {
    const mtgjsonId = '55555555-5555-4555-8555-555555555555';
    const card = await createCard({ id: mtgjsonId, name: 'Black Lotus' }, userA.id);
    expect(card.id).toBe(mtgjsonId);
    expect(card.name).toBe('Black Lotus');
  });

  test('deleteCard throws NotFoundError when card not found', async () => {
    await expect(() => deleteCard(UUID_BOLT, userA.id)).rejects.toThrow(NotFoundError);
  });
});

// ─── MTGJSON-decorated collection reads ───────────────────────────────────────

describe('cardService — getCards/getCard MTGJSON enrichment', () => {
  beforeEach(async () => {
    await aCard().forUser(userA).withId(UUID_BOLT).withName('Lightning Bolt').persist(dataSource);
    await aCard().forUser(userA).withId(UUID_SOL).withName('Sol Ring').persist(dataSource);
  });

  test('getCards returns provider-enriched rows for the user', async () => {
    registry.register('enrich-ok', makeProvider({
      getByUuids: async (uuids) =>
        uuids.map((id) => id === UUID_BOLT
          ? { ...LIGHTNING_BOLT, id }
          : { ...SOL_RING, id }),
    }));
    await registry.setActive('enrich-ok');

    const result = await getCards(userA.id);
    expect(result.total).toBe(2);
    const bolt = result.cards.find((c) => c.id === UUID_BOLT)!;
    expect(bolt.set).toBe('M11');
    const sol = result.cards.find((c) => c.id === UUID_SOL)!;
    expect(sol.set).toBe('C11');
  });

  test('getCard decorates a single row with setCode, setName, and typeLine', async () => {
    registry.register('enrich-getcard', makeProvider({
      getByUuid: async (uuid) => uuid === UUID_BOLT
        ? { uuid, name: 'Lightning Bolt', setCode: 'M11', setName: 'Magic 2011', cardNumber: '149', typeLine: 'Instant', scryfallId: null }
        : null,
    }));
    await registry.setActive('enrich-getcard');

    const card = await getCard(UUID_BOLT, userA.id);
    expect(card.id).toBe(UUID_BOLT);
    expect(card.setCode).toBe('M11');
    expect(card.setName).toBe('Magic 2011');
    expect(card.typeLine).toBe('Instant');
  });

  test('getCard returns the row unenriched when provider.getByUuid returns null', async () => {
    registry.register('enrich-null', makeProvider({ getByUuid: async () => null }));
    await registry.setActive('enrich-null');

    const card = await getCard(UUID_BOLT, userA.id);
    expect(card.id).toBe(UUID_BOLT);
    expect(card.setCode).toBeUndefined();
  });

  test('getCard returns the row unenriched when provider.getByUuid throws', async () => {
    registry.register('enrich-throw', makeProvider({
      getByUuid: async () => { throw new Error('parquet read failed'); },
    }));
    await registry.setActive('enrich-throw');

    const card = await getCard(UUID_BOLT, userA.id);
    expect(card.id).toBe(UUID_BOLT);
    expect(card.setCode).toBeUndefined();
  });
});

// ─── Provider-backed functions ────────────────────────────────────────────────

describe('cardService — provider-backed functions', () => {
  beforeAll(async () => {
    registry.register('test', makeProvider());
    await registry.setActive('test');
  });

  describe('checkCommanderLegality', () => {
    test('returns legal result for a legal card', async () => {
      registry.register('legal', makeProvider({
        checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
      }));
      await registry.setActive('legal');
      const result = await checkCommanderLegality('Sol Ring');
      expect(result.legal).toBe(true);
      expect(result.reason).toBeNull();
    });

    test('returns banned result', async () => {
      registry.register('banned-test', makeProvider({
        checkLegality: async (name) => ({ cardName: name, legal: false, reason: 'Banned in Commander', colorIdentity: [] }),
      }));
      await registry.setActive('banned-test');
      const result = await checkCommanderLegality('Black Lotus');
      expect(result.legal).toBe(false);
      expect(result.reason).toBe('Banned in Commander');
    });

    test('throws CardNotFoundError when provider throws CARD_NOT_FOUND', async () => {
      registry.register('missing-card', makeProvider({
        checkLegality: async (name) => {
          throw Object.assign(new Error(`No card found with name "${name}".`), { code: 'CARD_NOT_FOUND' });
        },
      }));
      await registry.setActive('missing-card');
      await expect(() => checkCommanderLegality('Nonexistent Card')).rejects.toThrow(CardNotFoundError);
    });

    test('throws ProviderUnavailableError when provider errors with non-CARD_NOT_FOUND', async () => {
      registry.register('unavailable', makeProvider({ checkLegality: async () => { throw new Error('timeout'); } }));
      await registry.setActive('unavailable');
      await expect(() => checkCommanderLegality('Any Card')).rejects.toThrow(ProviderUnavailableError);
    });
  });

  describe('searchCards', () => {
    // searchRaw now owns filtering, COUNT and paging; the fake paginates the
    // same way the real SQL would so the service-level assertions stay meaningful.
    const makePagedProvider = (total: number): CardProvider =>
      makeProvider({
        searchRaw: async (q) => {
          const all = Array.from({ length: total }, (_, i) => ({
            ...LIGHTNING_BOLT,
            name: `Card ${i + 1}`,
            cardNumber: String(i + 1),
          }));
          const page = Math.max(1, q.page ?? 1);
          const limit = Math.min(100, Math.max(1, q.limit ?? 20));
          const start = (page - 1) * limit;
          return { cards: all.slice(start, start + limit), total: all.length };
        },
      });

    beforeAll(async () => {
      registry.register('search', makePagedProvider(45));
      await registry.setActive('search');
    });

    test('returns paginated SearchResult', async () => {
      const result = await searchCards({ name: 'Card', page: 1, limit: 20 });
      expect(result.total).toBe(45);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(result.cards.length).toBe(20);
    });

    test('returns correct slice for page 2', async () => {
      const result = await searchCards({ name: 'Card', page: 2, limit: 20 });
      expect(result.cards.length).toBe(20);
      expect(result.cards[0]?.name).toBe('Card 21');
    });

    test('returns correct partial last page', async () => {
      const result = await searchCards({ name: 'Card', page: 3, limit: 20 });
      expect(result.cards.length).toBe(5);
    });

    test('defaults page=1 and limit=20', async () => {
      const result = await searchCards({ name: 'Card' });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('caps limit at 100', async () => {
      const result = await searchCards({ name: 'Card', limit: 999 });
      expect(result.limit).toBe(100);
    });

    test('returns totalPages=0 for empty result set', async () => {
      registry.register('empty', makeProvider({ searchRaw: async () => ({ cards: [], total: 0 }) }));
      await registry.setActive('empty');
      const result = await searchCards({ name: 'nothing' });
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.cards).toEqual([]);
      await registry.setActive('search');
    });

    test('Bubbles up original errors', async () => {
      const error = new Error('disk error');
      registry.register('search-broken', makeProvider({ searchRaw: async () => { throw error; } }));
      await registry.setActive('search-broken');
      await expect(() => searchCards({ name: 'x' })).rejects.toThrow(error);
    });

    test('forwards new filter dimensions through to the provider (FR-005)', async () => {
      const calls: SearchQuery[] = [];
      registry.register('search-forward', makeProvider({
        searchRaw: async (q) => {
          calls.push(q);
          return { cards: [], total: 0 };
        },
      }));
      await registry.setActive('search-forward');

      await searchCards({
        name: 'x',
        formats: ['Modern'],
        superTypes: ['Legendary'],
        creatureTypes: ['Elf'],
        missingOnly: false,
      });

      expect(calls.length).toBe(1);
      expect(calls[0]?.formats).toEqual(['Modern']);
      expect(calls[0]?.superTypes).toEqual(['Legendary']);
      expect(calls[0]?.creatureTypes).toEqual(['Elf']);
    });

    test('projects numberOwned per row when userId is supplied (LEFT JOIN semantics)', async () => {
      const providerCards: CardRecord[] = [
        { ...LIGHTNING_BOLT, id: UUID_BOLT },
        { ...SOL_RING, id: UUID_SOL },
      ];
      registry.register('search-with-user', makeProvider({
        searchRaw: async () => ({ cards: providerCards, total: providerCards.length }),
      }));
      await registry.setActive('search-with-user');

      // userA owns only Lightning Bolt (numberOwned defaults to 1 via the entity)
      await aCard().forUser(userA).withId(UUID_BOLT).withName('Lightning Bolt').persist(dataSource);

      const result = await searchCards({ name: 'any', userId: userA.id });

      const bolt = result.cards.find((c) => c.id === UUID_BOLT);
      const sol = result.cards.find((c) => c.id === UUID_SOL);
      expect(bolt?.numberOwned).toBe(1);
      expect(sol?.numberOwned).toBe(0);
    });

    test('omits numberOwned when no userId is supplied', async () => {
      registry.register('search-no-user', makeProvider({
        searchRaw: async () => ({ cards: [{ ...LIGHTNING_BOLT, id: UUID_BOLT }], total: 1 }),
      }));
      await registry.setActive('search-no-user');

      const result = await searchCards({ name: 'any' });
      expect(result.cards[0]?.numberOwned).toBeUndefined();
    });

    test('missingOnly: passes owned UUIDs as excludeUuids so they never appear (FR-005)', async () => {
      let receivedExclude: ReadonlyArray<string> | undefined;
      const providerCards: CardRecord[] = [
        { ...LIGHTNING_BOLT, id: UUID_BOLT },
        { ...SOL_RING, id: UUID_SOL },
      ];
      registry.register('search-missing-only', makeProvider({
        searchRaw: async (_q, opts) => {
          receivedExclude = opts?.excludeUuids;
          const excluded = new Set(opts?.excludeUuids ?? []);
          const cards = providerCards.filter((c) => !excluded.has(c.id));
          return { cards, total: cards.length };
        },
      }));
      await registry.setActive('search-missing-only');

      await aCard().forUser(userA).withId(UUID_BOLT).withName('Lightning Bolt').persist(dataSource);

      const result = await searchCards({ name: 'any', userId: userA.id, missingOnly: true });

      expect(receivedExclude).toEqual([UUID_BOLT]);
      expect(result.cards.map((c) => c.id)).toEqual([UUID_SOL]);
      expect(result.cards[0]?.numberOwned).toBe(0);
    });
  });

  describe('getCardImagesById', () => {
    const TEST_IMAGES: CardImages = {
      small: 'https://cards.scryfall.io/small/front/e/3/e3-uuid.jpg',
      medium: 'https://cards.scryfall.io/normal/front/e/3/e3-uuid.jpg',
      large: 'https://cards.scryfall.io/large/front/e/3/e3-uuid.jpg',
    };

    test('returns CardImages from the active provider on happy path', async () => {
      registry.register('images-ok', makeProvider({ getCardImages: async () => TEST_IMAGES }));
      await registry.setActive('images-ok');
      const result = await getCardImagesById('any-uuid');
      expect(result).toEqual(TEST_IMAGES);
    });

    test('throws CardNotFoundError when provider returns null', async () => {
      registry.register('images-null', makeProvider({ getCardImages: async () => null }));
      await registry.setActive('images-null');
      await expect(() => getCardImagesById('missing-uuid')).rejects.toThrow(CardNotFoundError);
    });

    test('throws ProviderUnavailableError when provider throws', async () => {
      registry.register('images-broken', makeProvider({
        getCardImages: async () => { throw new Error('parquet read failed'); },
      }));
      await registry.setActive('images-broken');
      await expect(() => getCardImagesById('any-uuid')).rejects.toThrow(ProviderUnavailableError);
    });
  });
});
