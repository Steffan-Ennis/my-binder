import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import authPlugin from '@src/auth/authPlugin';
import { issueToken } from '@src/auth/sessionJwt';
import { docsPlugin } from './docs';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';
const TEST_USER_ID = 'docs-test-user-uuid';

// Mock repositories so auth plugin can resolve the user from a JWT
jest.mock('@src/db/repositories', () => ({
  getRepositories: () => ({
    user: {
      findUserById: async (id: string) => (id === 'docs-test-user-uuid' ? { id: 'docs-test-user-uuid', email: 'docs@gmail.com', displayName: 'Docs User', avatarUrl: null } : null),
      upsertUser: async () => ({ id: 'docs-test-user-uuid', email: 'docs@gmail.com', displayName: 'Docs User', avatarUrl: null }),
    },
  }),
}));

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

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    process.env['GOOGLE_WEB_CLIENT_ID'] = 'test-web-client-id.apps.googleusercontent.com';

    fastify = await buildApp();
    await fastify.ready();

    authToken = issueToken(TEST_USER_ID, TEST_SECRET);
  });

  afterAll(async () => {
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
      expect(
        response.statusCode === 200 || response.statusCode === 302,
      ).toBe(true);
    });

    test('returns 200 or 302 with session cookie', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs',
        headers: { cookie: `session=${authToken}` },
      });
      expect(
        response.statusCode === 200 || response.statusCode === 302,
      ).toBe(true);
    });
  });

  describe('GET /docs/json (authenticated)', () => {
    test('returns 200 with OpenAPI object', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(response.statusCode).toBe(200);
    });

    test('OpenAPI object has info.title === "my-binder API"', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = response.json<{ info: { title: string } }>();
      expect(body.info.title).toBe('my-binder API');
    });
  });

  // ─── Unauthenticated gate ───────────────────────────────────────────────────

  describe('GET /docs/json (unauthenticated)', () => {
    test('returns 401 with UNAUTHORIZED code when no credentials', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/docs/json' });
      expect(response.statusCode).toBe(401);
      const body = response.json<{ code: string }>();
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /docs (unauthenticated browser)', () => {
    test('redirects to /auth/login when Accept: text/html and no credentials', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs',
        headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      });
      expect(response.statusCode).toBe(302);
      expect(response.headers['location']).toBe('/auth/login');
    });
  });

  describe('GET /docs/yaml (unauthenticated)', () => {
    test('returns 401 when no credentials', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/docs/yaml' });
      expect(response.statusCode).toBe(401);
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
      expect(body.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    test('response contains top-level security: [{ bearerAuth: [] }]', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = response.json<{ security: Array<Record<string, unknown>> }>();
      expect(Array.isArray(body.security)).toBe(true);
      expect(
        body.security.some((s) => 'bearerAuth' in s),
      ).toBe(true);
    });
  });
});
