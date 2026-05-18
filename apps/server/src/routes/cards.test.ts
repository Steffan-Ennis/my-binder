import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { MtgjsonSDK } from 'mtgjson-sdk';
import type { DataSource } from 'typeorm';

import { connectTestDatabase, disconnectTestDatabase } from '@root/testing/testDatabase';
import { aUser } from '@root/testing/userEntityBuilder';
import { aCard } from '@root/testing/cardEntityBuilder';
import { CardEntity } from '@src/entities/CardEntity';
import type { UserEntity } from '@src/entities/UserEntity';
import authPlugin from '@src/auth/authPlugin';
import { issueToken } from '@src/auth/sessionJwt';
import { cardRoutes } from '@src/routes/cards';
import { registry } from '@src/providers/registry';
import MtgjsonProvider from '@src/providers/mtgjson/MtgjsonProvider';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';
const CACHE_DIR = path.resolve(__dirname, '../../data/mtgjson-cache');

// Canonical fixture: Lightning Bolt printed in Magic 2011 (M11) #149.
// Verified against the local offline cache by MtgjsonProvider.test.ts.
const M11_BOLT_UUID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';
const M11_BOLT_SCRYFALL_ID = 'e768c957-3a1f-42f5-853a-96942f645df5';
const M11_BOLT_IMAGE_NORMAL = `https://cards.scryfall.io/normal/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`;
const M11_BOLT_IMAGE_SMALL = `https://cards.scryfall.io/small/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`;
const M11_BOLT_IMAGE_LARGE = `https://cards.scryfall.io/large/front/e/7/${M11_BOLT_SCRYFALL_ID}.jpg`;

// UUID intentionally absent from the offline cache.
const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

describe('Cards API', () => {
  let dataSource: DataSource;
  let sdk: MtgjsonSDK;
  let fastify: FastifyInstance;
  let testUser: UserEntity;
  let authToken: string;

  const authHeaders = () => ({ authorization: `Bearer ${authToken}` });

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;

    dataSource = await connectTestDatabase();

    sdk = await MtgjsonSDK.create({ cacheDir: CACHE_DIR, offline: true });
    registry.register('mtgjson', new MtgjsonProvider(sdk));
    await registry.setActive('mtgjson');

    testUser = await aUser().persist(dataSource);
    authToken = issueToken(testUser.id, TEST_SECRET);

    fastify = Fastify();
    await fastify.register(fastifyCookie);
    await fastify.register(authPlugin);
    await fastify.register(cardRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    await sdk.close();
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await dataSource.getRepository(CardEntity).deleteAll();
  });

  // ─── GET /cards ─────────────────────────────────────────────────────────────

  test('GET /cards returns an empty list when the user has no cards', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards', headers: authHeaders() });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ cards: unknown[]; total: number }>();
    expect(body.cards).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('GET /cards returns cards enriched from the offline MTGJSON cache', async () => {
    await aCard()
      .forUser(testUser)
      .withId(M11_BOLT_UUID)
      .withName('Lightning Bolt')
      .persist(dataSource);

    const r = await fastify.inject({ method: 'GET', url: '/cards', headers: authHeaders() });
    expect(r.statusCode).toBe(200);
    const body = r.json<{
      cards: Array<{ id: string; name: string; set: string; cardNumber: string }>;
      total: number;
    }>();
    expect(body.total).toBe(1);
    expect(body.cards[0]?.id).toBe(M11_BOLT_UUID);
    expect(body.cards[0]?.name).toBe('Lightning Bolt');
    expect(body.cards[0]?.set).toBe('M11');
    expect(body.cards[0]?.cardNumber).toBe('149');
  });

  test('GET /cards returns 401 without a Bearer token', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards' });
    expect(r.statusCode).toBe(401);
  });

  // ─── POST /cards ────────────────────────────────────────────────────────────

  test('POST /cards creates a card and returns 201', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const r = await fastify.inject({
      method: 'POST', url: '/cards',
      payload: { id, name: 'Black Lotus' },
      headers: authHeaders(),
    });
    expect(r.statusCode).toBe(201);
    const card = r.json<{ id: string; name: string }>();
    expect(card.id).toBe(id);
    expect(card.name).toBe('Black Lotus');
  });

  test('POST /cards returns 400 when required fields are missing', async () => {
    const r = await fastify.inject({
      method: 'POST', url: '/cards', payload: {}, headers: authHeaders(),
    });
    expect(r.statusCode).toBe(400);
  });

  test('POST /cards returns 401 without a Bearer token', async () => {
    const r = await fastify.inject({
      method: 'POST', url: '/cards',
      payload: { id: '33333333-3333-4333-8333-333333333333', name: 'Sol Ring' },
    });
    expect(r.statusCode).toBe(401);
  });

  // ─── GET /cards/:id ────────────────────────────────────────────────────────

  test('GET /cards/:id returns 200 with enriched setCode without frontFaceImageUrl', async () => {
    await aCard()
      .forUser(testUser)
      .withId(M11_BOLT_UUID)
      .withName('Lightning Bolt')
      .persist(dataSource);

    const r = await fastify.inject({
      method: 'GET', url: `/cards/${M11_BOLT_UUID}`, headers: authHeaders(),
    });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ id: string; setCode?: string; setName?: string; typeLine?: string; frontFaceImageUrl?: string }>();
    expect(body.id).toBe(M11_BOLT_UUID);
    expect(body.setCode).toBe('M11');
    expect(body.setName).toBe('Magic 2011');
    expect(body.typeLine).toBe('Instant');
    expect(body.frontFaceImageUrl).toBeUndefined();
  });

  test('GET /cards/:id returns 404 when the user has no card with that id', async () => {
    const r = await fastify.inject({
      method: 'GET', url: `/cards/${UNKNOWN_UUID}`, headers: authHeaders(),
    });
    expect(r.statusCode).toBe(404);
  });

  test('GET /cards/:id returns 401 without a Bearer token', async () => {
    const r = await fastify.inject({ method: 'GET', url: `/cards/${UNKNOWN_UUID}` });
    expect(r.statusCode).toBe(401);
  });

  // ─── full CRUD lifecycle ───────────────────────────────────────────────────

  test('full CRUD lifecycle: POST → GET → PUT → DELETE → GET 404', async () => {
    const id = '33333333-3333-4333-8333-333333333333';

    const created = await fastify.inject({
      method: 'POST', url: '/cards',
      payload: { id, name: 'Mox Ruby' },
      headers: authHeaders(),
    });
    expect(created.statusCode).toBe(201);

    const fetched = await fastify.inject({
      method: 'GET', url: `/cards/${id}`, headers: authHeaders(),
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json<{ name: string }>().name).toBe('Mox Ruby');

    const updated = await fastify.inject({
      method: 'PUT', url: `/cards/${id}`,
      payload: { name: 'Mox Pearl' },
      headers: authHeaders(),
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ name: string }>().name).toBe('Mox Pearl');

    const deleted = await fastify.inject({
      method: 'DELETE', url: `/cards/${id}`, headers: authHeaders(),
    });
    expect(deleted.statusCode).toBe(204);

    const gone = await fastify.inject({
      method: 'GET', url: `/cards/${id}`, headers: authHeaders(),
    });
    expect(gone.statusCode).toBe(404);
  });

  // ─── GET /cards/images/:id ────────────────────────────────────────────────

  test('GET /cards/images/:id returns 200 with small/medium/large URLs for a known uuid', async () => {
    const r = await fastify.inject({
      method: 'GET', url: `/cards/images/${M11_BOLT_UUID}`, headers: authHeaders(),
    });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ small: string; medium: string; large: string }>();
    expect(body.small).toBe(M11_BOLT_IMAGE_SMALL);
    expect(body.medium).toBe(M11_BOLT_IMAGE_NORMAL);
    expect(body.large).toBe(M11_BOLT_IMAGE_LARGE);
  });

  test('GET /cards/images/:id returns 404 CARD_NOT_FOUND when the uuid is unknown to the SDK', async () => {
    const r = await fastify.inject({
      method: 'GET', url: `/cards/images/${UNKNOWN_UUID}`, headers: authHeaders(),
    });
    expect(r.statusCode).toBe(404);
    expect(r.json<{ error: string }>().error).toBe('CARD_NOT_FOUND');
  });

  test('GET /cards/images/:id returns 400 VALIDATION_ERROR when :id is not a uuid', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/cards/images/not-a-uuid', headers: authHeaders(),
    });
    expect(r.statusCode).toBe(400);
    expect(r.json<{ error: string }>().error).toBe('VALIDATION_ERROR');
  });

  test('GET /cards/images/:id returns 401 without a Bearer token', async () => {
    const r = await fastify.inject({ method: 'GET', url: `/cards/images/${M11_BOLT_UUID}` });
    expect(r.statusCode).toBe(401);
  });
  
  // ─── GET /cards/legality (public — no auth) ────────────────────────────────

  test('GET /cards/legality returns 200 with a LegalityResult for a real card', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards/legality?name=Lightning+Bolt' });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ cardName: string; legal: boolean }>();
    expect(body.cardName).toBe('Lightning Bolt');
    expect(typeof body.legal).toBe('boolean');
  });

  test('GET /cards/legality returns 400 when name is missing', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards/legality' });
    expect(r.statusCode).toBe(400);
  });

  // ─── GET /cards/search (public — no auth) ──────────────────────────────────

  test('GET /cards/search returns 200 with a paginated SearchResult', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards/search?name=Lightning+Bolt' });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ cards: unknown[]; total: number; page: number; limit: number }>();
    expect(body.page).toBe(1);
    expect(Array.isArray(body.cards)).toBe(true);
  });

  test('GET /cards/search returns 400 MISSING_FILTER when no filter is provided', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards/search' });
    expect(r.statusCode).toBe(400);
    expect(r.json<{ error: string }>().error).toBe('MISSING_FILTER');
  });

  // ─── Spec 018 / FR-005 — catalogue filter dimensions ──────────────────────

  test('GET /cards/search accepts formats= and treats it as a valid filter', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/cards/search?formats=Modern' });
    expect(r.statusCode).toBe(200);
  });

  test('GET /cards/search accepts super_types= and creature_types=', async () => {
    const r = await fastify.inject({
      method: 'GET',
      url: '/cards/search?super_types=Legendary&creature_types=Elf',
    });
    expect(r.statusCode).toBe(200);
  });

  test('GET /cards/search with missing_only=true and no auth returns 401 AUTH_INVALID_TOKEN', async () => {
    const r = await fastify.inject({
      method: 'GET',
      url: '/cards/search?missing_only=true',
    });
    expect(r.statusCode).toBe(401);
    expect(r.json<{ error: string }>().error).toBe('AUTH_INVALID_TOKEN');
  });

  test('GET /cards/search with missing_only=true and Bearer auth returns 200', async () => {
    const r = await fastify.inject({
      method: 'GET',
      url: '/cards/search?missing_only=true&name=lightning',
      headers: authHeaders(),
    });
    expect(r.statusCode).toBe(200);
  });

  test('GET /cards/search authenticated returns numberOwned on every row', async () => {
    await aCard()
      .forUser(testUser)
      .withId(M11_BOLT_UUID)
      .withName('Lightning Bolt')
      .persist(dataSource);

    const r = await fastify.inject({
      method: 'GET',
      url: '/cards/search?name=lightning+bolt&set=M11',
      headers: authHeaders(),
    });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ cards: Array<{ id: string; numberOwned?: number }> }>();
    const bolt = body.cards.find((c) => c.id === M11_BOLT_UUID);
    expect(bolt?.numberOwned).toBeGreaterThanOrEqual(1);
  });

  test('GET /cards/search unauthenticated omits numberOwned on every row', async () => {
    const r = await fastify.inject({
      method: 'GET',
      url: '/cards/search?name=lightning+bolt&set=M11',
    });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ cards: Array<{ id: string; numberOwned?: number }> }>();
    for (const card of body.cards) {
      expect(card.numberOwned).toBeUndefined();
    }
  });
});
