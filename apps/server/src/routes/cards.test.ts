import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { initDb } from '@src/db/client';
import { cardRoutes } from '@src/routes/cards';

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
