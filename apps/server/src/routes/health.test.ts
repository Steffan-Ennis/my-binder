import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { initDb } from '@src/db/client';
import { healthRoutes } from '@src/routes/health';

describe('GET /health', () => {
  const fastify = Fastify();

  before(async () => {
    await initDb(':memory:');
    await fastify.register(healthRoutes);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  test('returns 200 with status ok when database is connected', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    const body = response.json<{ status: string; database: string }>();
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
  });
});
