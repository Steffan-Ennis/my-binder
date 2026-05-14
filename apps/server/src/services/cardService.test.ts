import type { CardProvider } from '@src/providers/interface';
import { registry } from '@src/providers/registry';
import {
  lookupCard,
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
import type { CardImages, CardRecord } from '@my-binder/core';

// ─── Constants ────────────────────────────────────────────────────────────────

const LIGHTNING_BOLT: CardRecord = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Lightning Bolt', set: 'M11', cardNumber: '149',
  manaCost: '{R}', colorIdentity: ['R'], commanderLegal: true, imageRef: null,
};
const SOL_RING: CardRecord = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Sol Ring', set: 'C11', cardNumber: '58',
  manaCost: '{1}', colorIdentity: [], commanderLegal: true, imageRef: null,
};

// ─── Mock repositories via @src/db/repositories ──────────────────────────────

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';

type CardRow = { id: string; name: string; userId: string; createdAt: string; updatedAt: string };
let mockCardStore: CardRow[] = [];
let nextId = 1;

const mockCardRepo = {
  findAll: async (userId: string) => mockCardStore.filter((c) => c.userId === userId),
  findById: async (id: string, userId: string) =>
    mockCardStore.find((c) => c.id === id && c.userId === userId) ?? null,
  create: async (body: { id: string; name: string }, userId: string) => {
    const row: CardRow = {
      id: body.id,
      name: body.name,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCardStore.push(row);
    nextId++;
    return row;
  },
  update: async (id: string, body: { name: string }, userId: string) => {
    const row = mockCardStore.find((c) => c.id === id && c.userId === userId);
    if (!row) return null;
    row.name = body.name;
    return row;
  },
  remove: async (id: string, userId: string) => {
    const idx = mockCardStore.findIndex((c) => c.id === id && c.userId === userId);
    if (idx === -1) return false;
    mockCardStore.splice(idx, 1);
    return true;
  },
};

jest.mock('@src/db/repositories', () => ({
  getRepositories: () => ({ card: mockCardRepo }),
}));

// ─── Provider helpers ─────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    lookup: async () => [LIGHTNING_BOLT],
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    search: async () => [LIGHTNING_BOLT, SOL_RING],
    getByUuid: async () => null,
    getByUuids: async () => [],
    getCardImages: async () => null,
    isReachable: async () => true,
    ...overrides,
  };
}

// ─── Collection functions ─────────────────────────────────────────────────────

describe('cardService — collection functions', () => {
  beforeAll(() => {
    mockCardStore = [];
    nextId = 1;
  });

  test('getCards returns only cards for the calling user', async () => {
    mockCardStore = [
      { id: 'c1', name: 'Lightning Bolt', userId: USER_A, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'c2', name: 'Sol Ring', userId: USER_B, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    const result = await getCards(USER_A);
    expect(result.cards.length).toBe(1);
    expect(result.cards[0]?.name).toBe('Lightning Bolt');
    expect(result.total).toBe(1);
  });

  test('getCard throws NotFoundError for unknown id', async () => {
    mockCardStore = [];
    await expect(() => getCard('unknown-id', USER_A)).rejects.toThrow(NotFoundError);
  });

  test('createCard creates and returns card', async () => {
    mockCardStore = [];
    const mtgjsonId = '55555555-5555-4555-8555-555555555555';
    const card = await createCard({ id: mtgjsonId, name: 'Black Lotus' }, USER_A);
    expect(card.id).toBe(mtgjsonId);
    expect(card.name).toBe('Black Lotus');
    expect(card.id).toBeTruthy();
  });

  test('deleteCard throws NotFoundError when card not found', async () => {
    mockCardStore = [];
    await expect(() => deleteCard('missing', USER_A)).rejects.toThrow(NotFoundError);
  });
});

// ─── MTGJSON-decorated collection reads ───────────────────────────────────────

describe('cardService — getCards/getCard MTGJSON enrichment', () => {
  const UUID_BOLT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const UUID_SOL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeAll(async () => {
    mockCardStore = [
      { id: UUID_BOLT, name: 'Lightning Bolt', userId: USER_A, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: UUID_SOL, name: 'Sol Ring', userId: USER_A, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    registry.register('enrich-ok', makeProvider({
      getByUuid: async (uuid) => uuid === UUID_BOLT
        ? { uuid, name: 'Lightning Bolt', setCode: 'M11', setName: 'Magic 2011', cardNumber: '149', typeLine: 'Instant', scryfallId: 'e3285fd6-aaaa-bbbb-cccc-ddddddddeeee' }
        : { uuid, name: 'Sol Ring', setCode: 'C11', setName: 'Commander 2011', cardNumber: '58', typeLine: 'Artifact', scryfallId: null },
    }));
    await registry.setActive('enrich-ok');
  });

  test('getCards decorates each row with frontFaceImageUrl, setName, setCode, typeLine', async () => {
    const result = await getCards(USER_A);
    expect(result.total).toBe(2);
    const bolt = result.cards.find((c) => c.id === UUID_BOLT)!;
    expect(bolt.setCode).toBe('M11');
    expect(bolt.setName).toBe('Magic 2011');
    expect(bolt.typeLine).toBe('Instant');
    expect(bolt.frontFaceImageUrl).toBe(
      'https://cards.scryfall.io/normal/front/e/3/e3285fd6-aaaa-bbbb-cccc-ddddddddeeee.jpg',
    );
  });

  test('getCards omits frontFaceImageUrl when scryfallId is null', async () => {
    const result = await getCards(USER_A);
    const sol = result.cards.find((c) => c.id === UUID_SOL)!;
    expect(sol.setCode).toBe('C11');
    expect(sol.setName).toBe('Commander 2011');
    expect(sol.frontFaceImageUrl).toBeUndefined();
  });

  test('getCard decorates a single row', async () => {
    const card = await getCard(UUID_BOLT, USER_A);
    expect(card.setCode).toBe('M11');
    expect(card.frontFaceImageUrl).toBe(
      'https://cards.scryfall.io/normal/front/e/3/e3285fd6-aaaa-bbbb-cccc-ddddddddeeee.jpg',
    );
  });

  test('getCards returns rows unenriched when provider.getByUuid returns null', async () => {
    registry.register('enrich-null', makeProvider({ getByUuid: async () => null }));
    await registry.setActive('enrich-null');
    const result = await getCards(USER_A);
    expect(result.cards.every((c) => c.frontFaceImageUrl === undefined)).toBe(true);
    expect(result.cards.every((c) => c.setCode === undefined)).toBe(true);
  });

  test('getCards returns rows unenriched when provider.getByUuid throws', async () => {
    registry.register('enrich-throw', makeProvider({
      getByUuid: async () => { throw new Error('parquet read failed'); },
    }));
    await registry.setActive('enrich-throw');
    const result = await getCards(USER_A);
    expect(result.cards.every((c) => c.frontFaceImageUrl === undefined)).toBe(true);
  });
});

// ─── Provider-backed functions ────────────────────────────────────────────────

describe('cardService — provider-backed functions', () => {
  beforeAll(async () => {
    registry.register('test', makeProvider());
    await registry.setActive('test');
  });

  describe('lookupCard', () => {
    test('returns CardRecord array when cards are found', async () => {
      const result = await lookupCard('Lightning Bolt');
      expect(Array.isArray(result)).toBe(true);
      expect((result as CardRecord[])[0]?.name).toBe('Lightning Bolt');
    });

    test('returns CardNotFoundResult when no match', async () => {
      registry.register('notfound', makeProvider({ lookup: async (name) => ({ found: false, name }) }));
      await registry.setActive('notfound');
      const result = await lookupCard('ZZZFake');
      expect(Array.isArray(result)).toBe(false);
      expect((result as { found: boolean }).found).toBe(false);
      await registry.setActive('test');
    });

    test('throws ProviderUnavailableError when provider errors', async () => {
      registry.register('broken', makeProvider({ lookup: async () => { throw new Error('connection lost'); } }));
      await registry.setActive('broken');
      await expect(() => lookupCard('anything')).rejects.toThrow(ProviderUnavailableError);
      await registry.setActive('test');
    });

    test('passes set option through to provider', async () => {
      let capturedOpts: Parameters<CardProvider['lookup']>[1] = {};
      registry.register('set-test', makeProvider({
        lookup: async (_name, opts) => { capturedOpts = opts ?? {}; return [LIGHTNING_BOLT]; },
      }));
      await registry.setActive('set-test');
      await lookupCard('Lightning Bolt', { set: 'M11' });
      expect(capturedOpts.set).toBe('M11');
      await registry.setActive('test');
    });

    test('passes number option through to provider', async () => {
      let capturedOpts: Parameters<CardProvider['lookup']>[1] = {};
      registry.register('number-test', makeProvider({
        lookup: async (_name, opts) => { capturedOpts = opts ?? {}; return [LIGHTNING_BOLT]; },
      }));
      await registry.setActive('number-test');
      await lookupCard('Lightning Bolt', { set: 'M11', number: '149' });
      expect(capturedOpts.set).toBe('M11');
      expect(capturedOpts.number).toBe('149');
      await registry.setActive('test');
    });
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
    beforeAll(async () => {
      registry.register('search', makeProvider({
        search: async () => Array.from({ length: 45 }, (_, i) => ({
          ...LIGHTNING_BOLT, name: `Card ${i + 1}`, cardNumber: String(i + 1),
        })),
      }));
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
      registry.register('empty', makeProvider({ search: async () => [] }));
      await registry.setActive('empty');
      const result = await searchCards({ name: 'nothing' });
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.cards).toEqual([]);
      await registry.setActive('search');
    });

    test('Bubbles up original errors', async () => {
      const error = new Error('disk error')

      registry.register('search-broken', makeProvider({ search: async () => { throw error; } }));
      await registry.setActive('search-broken');
      await expect(() => searchCards({ name: 'x' })).rejects.toThrow(error);
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
