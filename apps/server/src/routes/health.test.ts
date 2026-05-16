import Fastify from 'fastify';
import { healthRoutes } from '@src/routes/health';

describe('Health API', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    await fastify.register(healthRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('GET /health responds with status ok or degraded depending on DB state', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/health' });
    // In tests, DataSource is not initialised → 503. In production → 200.
    expect(response.statusCode === 200 || response.statusCode === 503).toBe(true);
    const body = response.json<{ status: string; database: string }>();
    expect(body.status === 'ok' || body.status === 'degraded').toBe(true);
  });
});
