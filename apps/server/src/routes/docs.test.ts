import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { DataSource } from 'typeorm';

import { connectTestDatabase, disconnectTestDatabase } from '@root/testing/testDatabase';
import { aUser } from '@root/testing/userEntityBuilder';
import authPlugin from '@src/auth/authPlugin';
import { issueToken } from '@src/auth/sessionJwt';
import { docsPlugin } from './docs';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';

describe('Docs API', () => {
  const fastify = Fastify();
  let dataSource: DataSource;
  let authToken: string;

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    process.env['GOOGLE_WEB_CLIENT_ID'] = 'test-web-client-id.apps.googleusercontent.com';

    dataSource = await connectTestDatabase();
    const user = await aUser()
      .withEmail('docs@gmail.com')
      .withDisplayName('Docs User')
      .persist(dataSource);
    authToken = issueToken(user.id, TEST_SECRET);

    await fastify.register(fastifyCookie);
    await fastify.register(authPlugin);
    await fastify.register(docsPlugin);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    await disconnectTestDatabase();
  });

  test('GET /docs returns 200 or 302 with a Bearer token', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs', headers: { authorization: `Bearer ${authToken}` },
    });
    expect(r.statusCode === 200 || r.statusCode === 302).toBe(true);
  });

  test('GET /docs returns 200 or 302 with a session cookie', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs', headers: { cookie: `session=${authToken}` },
    });
    expect(r.statusCode === 200 || r.statusCode === 302).toBe(true);
  });

  test('GET /docs/json returns 200 with the OpenAPI object for an authenticated request', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs/json', headers: { authorization: `Bearer ${authToken}` },
    });
    expect(r.statusCode).toBe(200);
  });

  test('GET /docs/json reports info.title as "my-binder API"', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs/json', headers: { authorization: `Bearer ${authToken}` },
    });
    expect(r.json<{ info: { title: string } }>().info.title).toBe('my-binder API');
  });

  test('GET /docs/json exposes the bearerAuth security scheme', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs/json', headers: { authorization: `Bearer ${authToken}` },
    });
    const body = r.json<{
      components: { securitySchemes: { bearerAuth: { type: string; scheme: string } } };
    }>();
    expect(body.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  test('GET /docs/json includes top-level security: [{ bearerAuth: [] }]', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs/json', headers: { authorization: `Bearer ${authToken}` },
    });
    const body = r.json<{ security: Array<Record<string, unknown>> }>();
    expect(Array.isArray(body.security)).toBe(true);
    expect(body.security.some((s) => 'bearerAuth' in s)).toBe(true);
  });

  test('GET /docs/json returns 401 UNAUTHORIZED when no credentials are supplied', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/docs/json' });
    expect(r.statusCode).toBe(401);
    expect(r.json<{ code: string }>().code).toBe('UNAUTHORIZED');
  });

  test('GET /docs redirects to /auth/login when Accept: text/html and no credentials', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/docs',
      headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    expect(r.statusCode).toBe(302);
    expect(r.headers['location']).toBe('/auth/login');
  });

  test('GET /docs/yaml returns 401 when no credentials are supplied', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/docs/yaml' });
    expect(r.statusCode).toBe(401);
  });
});
