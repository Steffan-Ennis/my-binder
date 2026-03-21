import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { providerRoutes } from './provider';
import { registry } from '@src/providers/registry';
import type { CardProvider } from '@src/providers/interface';

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    lookup: async () => ({ found: false, name: 'test' }),
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    search: async () => [],
    isReachable: async () => true,
    ...overrides,
  };
}

describe('Provider routes', () => {
  const fastify = Fastify();

  before(async () => {
    registry.register('provider-route-test', makeProvider());
    await registry.setActive('provider-route-test');
    await fastify.register(providerRoutes);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  // GET /provider
  describe('GET /provider', () => {
    test('returns 200 with active provider info', async () => {
      const r = await fastify.inject({ method: 'GET', url: '/provider' });
      assert.equal(r.statusCode, 200);
      const body = r.json<{ name: string; active: boolean; reachable: boolean }>();
      assert.equal(body.name, 'provider-route-test');
      assert.equal(body.active, true);
      assert.equal(body.reachable, true);
    });
  });

  // PUT /provider
  describe('PUT /provider', () => {
    test('returns 200 when switching to a registered reachable provider', async () => {
      registry.register('provider-alt', makeProvider());
      const r = await fastify.inject({
        method: 'PUT',
        url: '/provider',
        payload: { name: 'provider-alt' },
      });
      assert.equal(r.statusCode, 200);
      const body = r.json<{ name: string; active: boolean }>();
      assert.equal(body.name, 'provider-alt');
      assert.equal(body.active, true);

      // Restore
      await registry.setActive('provider-route-test');
    });

    test('returns 404 when provider is not registered', async () => {
      const r = await fastify.inject({
        method: 'PUT',
        url: '/provider',
        payload: { name: 'unknown-provider' },
      });
      assert.equal(r.statusCode, 404);
      assert.equal(r.json<{ error: string }>().error, 'PROVIDER_NOT_FOUND');
    });

    test('returns 422 when provider is registered but unreachable', async () => {
      registry.register('provider-dead', makeProvider({ isReachable: async () => false }));
      const r = await fastify.inject({
        method: 'PUT',
        url: '/provider',
        payload: { name: 'provider-dead' },
      });
      assert.equal(r.statusCode, 422);
      assert.equal(r.json<{ error: string }>().error, 'PROVIDER_UNAVAILABLE');
    });

    test('keeps current active provider after a 422 rejection', async () => {
      registry.register('provider-dead2', makeProvider({ isReachable: async () => false }));
      await fastify.inject({ method: 'PUT', url: '/provider', payload: { name: 'provider-dead2' } });

      // Active provider should still be 'provider-route-test'.
      const r = await fastify.inject({ method: 'GET', url: '/provider' });
      assert.equal(r.json<{ name: string }>().name, 'provider-route-test');
    });

    test('returns 400 when body is missing name', async () => {
      const r = await fastify.inject({ method: 'PUT', url: '/provider', payload: {} });
      assert.equal(r.statusCode, 400);
    });
  });
});
