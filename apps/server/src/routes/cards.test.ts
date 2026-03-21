import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { initDb } from '@src/db/client';
import { cardRoutes } from '@src/routes/cards';
import { registry } from '@src/providers/registry';
import type { CardProvider } from '@src/providers/interface';
import type { CardRecord } from '@my-binder/core';

describe('Cards API', () => {
  const fastify = Fastify();

  before(async () => {
    await initDb(':memory:');
    await fastify.register(cardRoutes);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  test('GET /cards returns empty list initially', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/cards' });
    assert.equal(response.statusCode, 200);
    const body = response.json<{ cards: unknown[]; total: number }>();
    assert.deepEqual(body.cards, []);
    assert.equal(body.total, 0);
  });

  test('POST /cards creates a card and returns 201', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/cards',
      payload: { name: 'Black Lotus' },
    });
    assert.equal(response.statusCode, 201);
    const card = response.json<{ id: string; name: string }>();
    assert.equal(card.name, 'Black Lotus');
    assert.ok(card.id);
  });

  test('POST /cards returns 400 for missing name', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/cards',
      payload: {},
    });
    assert.equal(response.statusCode, 400);
  });

  test('GET /cards/:id returns 404 for unknown id', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/cards/00000000-0000-0000-0000-000000000000',
    });
    assert.equal(response.statusCode, 404);
  });

  test('full CRUD lifecycle', async () => {
    // Create
    const created = await fastify.inject({
      method: 'POST',
      url: '/cards',
      payload: { name: 'Mox Ruby' },
    });
    assert.equal(created.statusCode, 201);
    const { id } = created.json<{ id: string }>();

    // Read
    const fetched = await fastify.inject({ method: 'GET', url: `/cards/${id}` });
    assert.equal(fetched.statusCode, 200);
    assert.equal(fetched.json<{ name: string }>().name, 'Mox Ruby');

    // Update
    const updated = await fastify.inject({
      method: 'PUT',
      url: `/cards/${id}`,
      payload: { name: 'Mox Pearl' },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json<{ name: string }>().name, 'Mox Pearl');

    // Delete
    const deleted = await fastify.inject({ method: 'DELETE', url: `/cards/${id}` });
    assert.equal(deleted.statusCode, 204);

    // Confirm gone
    const gone = await fastify.inject({ method: 'GET', url: `/cards/${id}` });
    assert.equal(gone.statusCode, 404);
  });
});

// ─── Provider-backed card routes ─────────────────────────────────────────────

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

describe('Cards API — provider routes', () => {
  const fastify = Fastify();

  before(async () => {
    await initDb(':memory:');
    registry.register('route-test', makeProvider());
    await registry.setActive('route-test');
    await fastify.register(cardRoutes);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  // GET /cards/lookup
  describe('GET /cards/lookup', () => {
    test('returns 200 with found:true and cards array when card exists', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=Lightning+Bolt' });
      assert.equal(r.statusCode, 200);
      const body = r.json<{ found: boolean; cards: CardRecord[] }>();
      assert.equal(body.found, true);
      assert.equal(body.cards[0]?.name, 'Lightning Bolt');
    });

    test('returns 200 with found:false when card is not found', async () => {
      registry.register('lookup-miss', makeProvider({
        lookup: async (name) => ({ found: false, name }),
      }));
      await registry.setActive('lookup-miss');

      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=ZZZFake' });
      assert.equal(r.statusCode, 200);
      assert.equal(r.json<{ found: boolean }>().found, false);

      await registry.setActive('route-test');
    });

    test('returns 400 when name is missing', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup' });
      assert.equal(r.statusCode, 400);
    });

    test('returns 503 when provider is unavailable', async () => {
      registry.register('lookup-down', makeProvider({
        lookup: async () => { throw new Error('down'); },
      }));
      await registry.setActive('lookup-down');

      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=test' });
      assert.equal(r.statusCode, 503);
      assert.equal(r.json<{ error: string }>().error, 'PROVIDER_UNAVAILABLE');

      await registry.setActive('route-test');
    });

    test('passes set param and returns 200 with matching cards', async () => {
      registry.register('set-route', makeProvider({
        lookup: async (_name, opts) => {
          if (opts?.set === 'M11') return [BOLT];
          return { found: false, name: _name };
        },
      }));
      await registry.setActive('set-route');

      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=Lightning+Bolt&set=M11' });
      assert.equal(r.statusCode, 200);
      const body = r.json<{ found: boolean; cards: CardRecord[] }>();
      assert.equal(body.found, true);
      assert.equal(body.cards[0]?.set, 'M11');

      await registry.setActive('route-test');
    });

    test('returns found:false when set+number combination has no match', async () => {
      registry.register('number-route', makeProvider({
        lookup: async (_name, opts) => {
          if (opts?.set === 'M11' && opts?.number === '999') return { found: false, name: _name };
          return [BOLT];
        },
      }));
      await registry.setActive('number-route');

      const r = await fastify.inject({ method: 'GET', url: '/cards/lookup?name=Lightning+Bolt&set=M11&number=999' });
      assert.equal(r.statusCode, 200);
      assert.equal(r.json<{ found: boolean }>().found, false);

      await registry.setActive('route-test');
    });
  });

  // GET /cards/legality
  describe('GET /cards/legality', () => {
    test('returns 200 with legal:true for a legal card', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/legality?name=Sol+Ring' });
      assert.equal(r.statusCode, 200);
      assert.equal(r.json<{ legal: boolean }>().legal, true);
    });

    test('returns 200 with legal:false and reason for a banned card', async () => {
      registry.register('legality-banned', makeProvider({
        checkLegality: async (name) => ({
          cardName: name, legal: false, reason: 'Banned in Commander', colorIdentity: [],
        }),
      }));
      await registry.setActive('legality-banned');

      const r = await fastify.inject({ method: 'GET', url: '/cards/legality?name=Black+Lotus' });
      assert.equal(r.statusCode, 200);
      const body = r.json<{ legal: boolean; reason: string }>();
      assert.equal(body.legal, false);
      assert.equal(body.reason, 'Banned in Commander');

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
      assert.equal(r.statusCode, 404);
      assert.equal(r.json<{ error: string }>().error, 'CARD_NOT_FOUND');

      await registry.setActive('route-test');
    });

    test('returns 400 when name is missing', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/legality' });
      assert.equal(r.statusCode, 400);
    });
  });

  // GET /cards/search
  describe('GET /cards/search', () => {
    test('returns 200 SearchResult with filters', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/search?colors=R&cmc_max=1' });
      assert.equal(r.statusCode, 200);
      const body = r.json<{ cards: unknown[]; total: number; page: number }>();
      assert.equal(body.page, 1);
      assert.ok(Array.isArray(body.cards));
    });

    test('returns 400 when no filter is provided', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/cards/search' });
      assert.equal(r.statusCode, 400);
      assert.equal(r.json<{ error: string }>().error, 'MISSING_FILTER');
    });

    test('returns 503 when provider is unavailable', async () => {
      registry.register('search-down', makeProvider({
        search: async () => { throw new Error('down'); },
      }));
      await registry.setActive('search-down');

      const r = await fastify.inject({ method: 'GET', url: '/cards/search?name=bolt' });
      assert.equal(r.statusCode, 503);

      await registry.setActive('route-test');
    });
  });
});
