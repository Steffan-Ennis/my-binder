import Fastify from 'fastify';
import { providerRoutes } from './provider';
import { registry } from '@src/providers/registry';
import type { CardProvider } from '@src/providers/interface';

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    searchRaw: async () => ({ cards: [], total: 0 }),
    getByUuid: async () => null,
    getByUuids: async () => [],
    getCardImages: async () => null,
    getPrices: async (uuid) => ({ printingId: uuid, cardKingdom: null, tcgPlayer: null }),
    getPriceHistory: async (uuid, days) => ({ printingId: uuid, days, cardKingdom: [], tcgPlayer: [] }),
    isReachable: async () => true,
    ...overrides,
  };
}

describe('Provider routes', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    registry.register('provider-route-test', makeProvider());
    await registry.setActive('provider-route-test');
    await fastify.register(providerRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('GET /provider returns 200 with the active provider info', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/provider' });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ name: string; active: boolean; reachable: boolean }>();
    expect(body.name).toBe('provider-route-test');
    expect(body.active).toBe(true);
    expect(body.reachable).toBe(true);
  });

  test('PUT /provider returns 200 when switching to a registered reachable provider', async () => {
    registry.register('provider-alt', makeProvider());
    const r = await fastify.inject({
      method: 'PUT', url: '/provider', payload: { name: 'provider-alt' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ name: string; active: boolean }>().name).toBe('provider-alt');
    await registry.setActive('provider-route-test');
  });

  test('PUT /provider returns 404 PROVIDER_NOT_FOUND when the provider is not registered', async () => {
    const r = await fastify.inject({
      method: 'PUT', url: '/provider', payload: { name: 'unknown-provider' },
    });
    expect(r.statusCode).toBe(404);
    expect(r.json<{ error: string }>().error).toBe('PROVIDER_NOT_FOUND');
  });

  test('PUT /provider returns 422 PROVIDER_UNAVAILABLE when the provider is registered but unreachable', async () => {
    registry.register('provider-dead', makeProvider({ isReachable: async () => false }));
    const r = await fastify.inject({
      method: 'PUT', url: '/provider', payload: { name: 'provider-dead' },
    });
    expect(r.statusCode).toBe(422);
    expect(r.json<{ error: string }>().error).toBe('PROVIDER_UNAVAILABLE');
  });

  test('PUT /provider keeps the current active provider after a 422 rejection', async () => {
    registry.register('provider-dead2', makeProvider({ isReachable: async () => false }));
    await fastify.inject({ method: 'PUT', url: '/provider', payload: { name: 'provider-dead2' } });

    const r = await fastify.inject({ method: 'GET', url: '/provider' });
    expect(r.json<{ name: string }>().name).toBe('provider-route-test');
  });

  test('PUT /provider returns 400 when the body is missing the name field', async () => {
    const r = await fastify.inject({ method: 'PUT', url: '/provider', payload: {} });
    expect(r.statusCode).toBe(400);
  });
});
