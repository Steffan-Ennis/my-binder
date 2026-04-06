import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import authPlugin from '@src/auth/authPlugin';
import { issueToken } from '@src/auth/sessionJwt';
import { docsPlugin } from './docs';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';
const TEST_USER_ID = 'docs-test-user-uuid';

const MOCK_USER = {
  id: TEST_USER_ID,
  email: 'docs@gmail.com',
  displayName: 'Docs User',
  avatarUrl: null,
};

// Mock repositories so auth plugin can resolve the user from a JWT
mock.module('@src/db/repositories', {
  namedExports: {
    getRepositories: () => ({
      user: {
        findUserById: async (id: string) => (id === TEST_USER_ID ? MOCK_USER : null),
        upsertUser: async () => MOCK_USER,
      },
    }),
  },
});

async function buildApp() {
  const fastify = Fastify();
  await fastify.register(fastifyCookie);
  await fastify.register(authPlugin);
  await fastify.register(docsPlugin);
  return fastify;
}

describe('Docs API', () => {
  let fastify: Awaited<ReturnType<typeof buildApp>>;
  let authToken: string;

  before(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    process.env['GOOGLE_WEB_CLIENT_ID'] = 'test-web-client-id.apps.googleusercontent.com';

    fastify = await buildApp();
    await fastify.ready();

    authToken = issueToken(TEST_USER_ID, TEST_SECRET);
  });

  after(async () => {
    await fastify.close();
  });

  // ─── Authenticated access ───────────────────────────────────────────────────

  describe('GET /docs (authenticated)', () => {
    test('returns 200 or 302 with Bearer token', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs',
        headers: { authorization: `Bearer ${authToken}` },
      });
      assert.ok(
        response.statusCode === 200 || response.statusCode === 302,
        `expected 200 or 302, got ${response.statusCode}`,
      );
    });

    test('returns 200 or 302 with session cookie', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs',
        headers: { cookie: `session=${authToken}` },
      });
      assert.ok(
        response.statusCode === 200 || response.statusCode === 302,
        `expected 200 or 302, got ${response.statusCode}`,
      );
    });
  });

  describe('GET /docs/json (authenticated)', () => {
    test('returns 200 with OpenAPI object', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      assert.equal(response.statusCode, 200);
    });

    test('OpenAPI object has info.title === "my-binder API"', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = response.json<{ info: { title: string } }>();
      assert.equal(body.info.title, 'my-binder API');
    });
  });

  // ─── Unauthenticated gate ───────────────────────────────────────────────────

  describe('GET /docs/json (unauthenticated)', () => {
    test('returns 401 with UNAUTHORIZED code when no credentials', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/docs/json' });
      assert.equal(response.statusCode, 401);
      const body = response.json<{ code: string }>();
      assert.equal(body.code, 'UNAUTHORIZED');
    });
  });

  describe('GET /docs (unauthenticated browser)', () => {
    test('redirects to /auth/login when Accept: text/html and no credentials', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs',
        headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      });
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers['location'], '/auth/login');
    });
  });

  describe('GET /docs/yaml (unauthenticated)', () => {
    test('returns 401 when no credentials', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/docs/yaml' });
      assert.equal(response.statusCode, 401);
    });
  });

  // ─── bearerAuth security scheme ─────────────────────────────────────────────

  describe('GET /docs/json — security scheme (authenticated)', () => {
    test('response contains components.securitySchemes.bearerAuth', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = response.json<{
        components: { securitySchemes: { bearerAuth: { type: string; scheme: string } } };
        security: Array<Record<string, unknown>>;
      }>();
      assert.equal(body.components.securitySchemes.bearerAuth.type, 'http');
      assert.equal(body.components.securitySchemes.bearerAuth.scheme, 'bearer');
    });

    test('response contains top-level security: [{ bearerAuth: [] }]', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = response.json<{ security: Array<Record<string, unknown>> }>();
      assert.ok(Array.isArray(body.security), 'expected security array');
      assert.ok(
        body.security.some((s) => 'bearerAuth' in s),
        'expected bearerAuth in security array',
      );
    });
  });
});
