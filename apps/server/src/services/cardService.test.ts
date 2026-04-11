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
  NotFoundError,
  CardNotFoundError,
  ProviderUnavailableError,
} from './cardService';
import type { CardRecord } from '@my-binder/core';

// ─── Constants ────────────────────────────────────────────────────────────────

const LIGHTNING_BOLT: CardRecord = {
  name: 'Lightning Bolt', set: 'M11', cardNumber: '149',
  manaCost: '{R}', colorIdentity: ['R'], commanderLegal: true, imageRef: null,
};
const SOL_RING: CardRecord = {
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
  create: async (body: { name: string }, userId: string) => {
    const row: CardRow = {
      id: `card-${nextId++}`,
      name: body.name,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCardStore.push(row);
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
    const card = await createCard({ name: 'Black Lotus' }, USER_A);
    expect(card.name).toBe('Black Lotus');
    expect(card.id).toBeTruthy();
  });

  test('deleteCard throws NotFoundError when card not found', async () => {
    mockCardStore = [];
    await expect(() => deleteCard('missing', USER_A)).rejects.toThrow(NotFoundError);
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

    test('throws ProviderUnavailableError when provider errors', async () => {
      registry.register('search-broken', makeProvider({ search: async () => { throw new Error('disk error'); } }));
      await registry.setActive('search-broken');
      await expect(() => searchCards({ name: 'x' })).rejects.toThrow(ProviderUnavailableError);
    });
  });
});
