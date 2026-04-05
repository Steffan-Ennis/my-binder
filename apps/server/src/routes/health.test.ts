import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { healthRoutes } from '@src/routes/health';

describe('GET /health', () => {
  const fastify = Fastify();

  before(async () => {
    await fastify.register(healthRoutes);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  test('responds with health status (200 ok or 503 degraded depending on DB state)', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/health' });
    // In tests, DataSource is not initialized → 503. In production → 200.
    assert.ok(
      response.statusCode === 200 || response.statusCode === 503,
      `expected 200 or 503, got ${response.statusCode}`,
    );
    const body = response.json<{ status: string; database: string }>();
    assert.ok(body.status === 'ok' || body.status === 'degraded');
  });
});
