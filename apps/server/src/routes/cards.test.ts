import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import authPlugin from '@src/auth/authPlugin';
import { cardRoutes } from '@src/routes/cards';
import { registry } from '@src/providers/registry';
import type { CardProvider } from '@src/providers/interface';
import type { CardRecord } from '@my-binder/core';

// ─── Mock repositories ────────────────────────────────────────────────────────

const TEST_USER_ID = 'test-user-uuid-0001';
const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';

const MOCK_USER = { id: TEST_USER_ID, email: 'user@example.com', displayName: 'Test User', avatarUrl: null };

// In-memory card store (scoped to userId)
type CardRow = { id: string; name: string; userId: string; createdAt: Date; updatedAt: Date };
let cardStore: CardRow[] = [];
let nextId = 1;

function makeCardRow(name: string, userId: string): CardRow {
  const id = `00000000-0000-0000-0000-${String(nextId++).padStart(12, '0')}`;
  return { id, name, userId, createdAt: new Date(), updatedAt: new Date() };
}

function toCardJson(row: CardRow) {
  return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

jest.mock('@src/db/repositories', () => ({
  getRepositories: () => ({
    user: {
      findUserById: async (id: string) => (id === 'test-user-uuid-0001' ? { id: 'test-user-uuid-0001', email: 'user@example.com', displayName: 'Test User', avatarUrl: null } : null),
      upsertUser: async () => ({ id: 'test-user-uuid-0001', email: 'user@example.com', displayName: 'Test User', avatarUrl: null }),
    },
    card: {
      findAll: async (userId: string) =>
        cardStore.filter((c) => c.userId === userId).map(toCardJson),
      findById: async (id: string, userId: string) => {
        const card = cardStore.find((c) => c.id === id && c.userId === userId);
        return card ? toCardJson(card) : null;
      },
      create: async (body: { name: string }, userId: string) => {
        const row = makeCardRow(body.name, userId);
        cardStore.push(row);
        return toCardJson(row);
      },
      update: async (id: string, body: { name: string }, userId: string) => {
        const card = cardStore.find((c) => c.id === id && c.userId === userId);
        if (!card) return null;
        card.name = body.name;
        card.updatedAt = new Date();
        return toCardJson(card);
      },
      remove: async (id: string, userId: string) => {
        const idx = cardStore.findIndex((c) => c.id === id && c.userId === userId);
        if (idx === -1) return false;
        cardStore.splice(idx, 1);
        return true;
      },
    },
  }),
}));

// ─── Provider stubs ───────────────────────────────────────────────────────────

const BOLT: CardRecord = {
  name: 'Lightning Bolt', set: 'M11', cardNumber: '149',
  manaCost: '{R}', colorIdentity: ['R'], commanderLegal: true, imageRef: null,
};

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    lookup: async () => [BOLT],
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    search: async () => [BOLT],
    isReachable: async () => true,
    ...overrides,
  };
}

async function buildAuthApp() {
  const fastify = Fastify();
  await fastify.register(fastifyCookie);
  await fastify.register(authPlugin);
  await fastify.register(cardRoutes);
  return fastify;
}

// ─── Collection CRUD (requires auth) ─────────────────────────────────────────

describe('Cards API — collection CRUD (authenticated)', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    cardStore = [];
    // Provide a no-op authenticate so cardRoutes can register its preHandler
    fastify.decorate('authenticate', async () => {});
    fastify.addHook('onRequest', async (req) => {
      // Manually set identity to avoid full auth plugin DB lookup complexity
      (req as unknown as { identity: unknown }).identity = { kind: 'authenticated', user: MOCK_USER };
    });
    await fastify.register(cardRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('GET /cards returns empty list initially', async () => {
    cardStore = [];
    const response = await fastify.inject({ method: 'GET', url: '/cards' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ cards: unknown[]; total: number }>();
    expect(body.cards).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('POST /cards creates a card and returns 201', async () => {
    const response = await fastify.inject({
      method: 'POST', url: '/cards', payload: { name: 'Black Lotus' },
    });
    expect(response.statusCode).toBe(201);
    const card = response.json<{ id: string; name: string }>();
    expect(card.name).toBe('Black Lotus');
    expect(card.id).toBeTruthy();
  });

  test('POST /cards returns 400 for missing name', async () => {
    const response = await fastify.inject({
      method: 'POST', url: '/cards', payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  test('GET /cards/:id returns 404 for unknown id', async () => {
    const response = await fastify.inject({
      method: 'GET', url: '/cards/00000000-0000-0000-0000-000000000000',
    });
    expect(response.statusCode).toBe(404);
  });

  test('full CRUD lifecycle', async () => {
    cardStore = [];

    const created = await fastify.inject({
      method: 'POST', url: '/cards', payload: { name: 'Mox Ruby' },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();

    const fetched = await fastify.inject({ method: 'GET', url: `/cards/${id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json<{ name: string }>().name).toBe('Mox Ruby');

    const updated = await fastify.inject({
      method: 'PUT', url: `/cards/${id}`, payload: { name: 'Mox Pearl' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ name: string }>().name).toBe('Mox Pearl');

    const deleted = await fastify.inject({ method: 'DELETE', url: `/cards/${id}` });
    expect(deleted.statusCode).toBe(204);

    const gone = await fastify.inject({ method: 'GET', url: `/cards/${id}` });
    expect(gone.statusCode).toBe(404);
  });
});

// ─── Collection routes require auth ──────────────────────────────────────────

describe('Cards API — collection routes require authentication', () => {
  let fastify: Awaited<ReturnType<typeof buildAuthApp>>;

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    fastify = await buildAuthApp();
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('GET /cards returns 401 without auth', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/cards' });
    expect(response.statusCode).toBe(401);
  });

  test('POST /cards returns 401 without auth', async () => {
    const response = await fastify.inject({ method: 'POST', url: '/cards', payload: { name: 'Test' } });
    expect(response.statusCode).toBe(401);
  });

  test('GET /cards/:id returns 401 without auth', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/cards/00000000-0000-0000-0000-000000000099' });
    expect(response.statusCode).toBe(401);
  });
});

// ─── Provider-backed card routes ──────────────────────────────────────────────

describe('Cards API — provider routes', () => {
  let fastify: Awaited<ReturnType<typeof buildAuthApp>>;

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    registry.register('route-test', makeProvider());
    await registry.setActive('route-test');
    fastify = await buildAuthApp();
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('GET /cards/lookup', () => {
    test('returns 200 with found:true and cards array when card exists', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=Lightning+Bolt' });
      expect(r.statusCode).toBe(200);
      const body = r.json<{ found: boolean; cards: CardRecord[] }>();
      expect(body.found).toBe(true);
      expect(body.cards[0]?.name).toBe('Lightning Bolt');
    });

    test('returns 200 with found:false when card is not found', async () => {
      registry.register('lookup-miss', makeProvider({ lookup: async (name) => ({ found: false, name }) }));
      await registry.setActive('lookup-miss');
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=ZZZFake' });
      expect(r.statusCode).toBe(200);
      expect(r.json<{ found: boolean }>().found).toBe(false);
      await registry.setActive('route-test');
    });

    test('returns 400 when name is missing', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup' });
      expect(r.statusCode).toBe(400);
    });

    test('returns 503 when provider is unavailable', async () => {
      registry.register('lookup-down', makeProvider({ lookup: async () => { throw new Error('down'); } }));
      await registry.setActive('lookup-down');
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=test' });
      expect(r.statusCode).toBe(503);
      expect(r.json<{ error: string }>().error).toBe('PROVIDER_UNAVAILABLE');
      await registry.setActive('route-test');
    });

    test('passes set param and returns 200 with matching cards', async () => {
      registry.register('set-route', makeProvider({
        lookup: async (_name, opts) => opts?.set === 'M11' ? [BOLT] : { found: false, name: _name },
      }));
      await registry.setActive('set-route');
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=Lightning+Bolt&set=M11' });
      expect(r.statusCode).toBe(200);
      const body = r.json<{ found: boolean; cards: CardRecord[] }>();
      expect(body.found).toBe(true);
      expect(body.cards[0]?.set).toBe('M11');
      await registry.setActive('route-test');
    });

    test('returns found:false when set+number combination has no match', async () => {
      registry.register('number-route', makeProvider({
        lookup: async (_name, opts) =>
          opts?.set === 'M11' && opts?.number === '999' ? { found: false, name: _name } : [BOLT],
      }));
      await registry.setActive('number-route');
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=Lightning+Bolt&set=M11&number=999' });
      expect(r.statusCode).toBe(200);
      expect(r.json<{ found: boolean }>().found).toBe(false);
      await registry.setActive('route-test');
    });
  });

  describe('GET /cards/legality', () => {
    test('returns 200 with legal:true for a legal card', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/legality?name=Sol+Ring' });
      expect(r.statusCode).toBe(200);
      expect(r.json<{ legal: boolean }>().legal).toBe(true);
    });

    test('returns 200 with legal:false and reason for a banned card', async () => {
      registry.register('legality-banned', makeProvider({
        checkLegality: async (name) => ({ cardName: name, legal: false, reason: 'Banned in Commander', colorIdentity: [] }),
      }));
      await registry.setActive('legality-banned');
      const r = await fastify.inject({ method: 'GET', url: '/cards/legality?name=Black+Lotus' });
      expect(r.statusCode).toBe(200);
      const body = r.json<{ legal: boolean; reason: string }>();
      expect(body.legal).toBe(false);
      expect(body.reason).toBe('Banned in Commander');
      await registry.setActive('route-test');
    });

    test('returns 404 when card is not found', async () => {
      registry.register('legality-notfound', makeProvider({
        checkLegality: async (name) => {
          throw Object.assign(new Error(`No card found with name "${name}".`), { code: 'CARD_NOT_FOUND' });
        },
      }));
      await registry.setActive('legality-notfound');
      const r = await fastify.inject({ method: 'GET', url: '/cards/legality?name=Fake' });
      expect(r.statusCode).toBe(404);
      expect(r.json<{ error: string }>().error).toBe('CARD_NOT_FOUND');
      await registry.setActive('route-test');
    });

    test('returns 400 when name is missing', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/legality' });
      expect(r.statusCode).toBe(400);
    });
  });

  describe('GET /cards/search', () => {
    test('returns 200 SearchResult with filters', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/search?colors=R&cmc_max=1' });
      expect(r.statusCode).toBe(200);
      const body = r.json<{ cards: unknown[]; total: number; page: number }>();
      expect(body.page).toBe(1);
      expect(Array.isArray(body.cards)).toBe(true);
    });

    test('returns 400 when no filter is provided', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/search' });
      expect(r.statusCode).toBe(400);
      expect(r.json<{ error: string }>().error).toBe('MISSING_FILTER');
    });

    test('returns 503 when provider is unavailable', async () => {
      registry.register('search-down', makeProvider({ search: async () => { throw new Error('down'); } }));
      await registry.setActive('search-down');
      const r = await fastify.inject({ method: 'GET', url: '/cards/search?name=bolt' });
      expect(r.statusCode).toBe(503);
      await registry.setActive('route-test');
    });
  });
});
