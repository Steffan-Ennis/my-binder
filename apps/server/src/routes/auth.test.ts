import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { initDb } from '@src/db/client';
import authPlugin from '@src/auth/plugin';
import { authRoutes } from './auth';
import { InvalidGoogleTokenError } from '@src/services/authService';
import { issueToken } from '@src/auth/sessionJwt';
import { upsertUser } from '@src/repositories/userRepository';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';

const MOCK_USER = {
  id: 'test-user-uuid-0001',
  email: 'user@gmail.com',
  displayName: 'Jane Doe',
  avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
};

const mockSignInSuccess = async (_idToken: string) => ({
  token: 'mock-session-jwt',
  user: MOCK_USER,
});

const mockSignInFailure = async (_idToken: string): Promise<never> => {
  throw new InvalidGoogleTokenError(new Error('Token is invalid'));
};

describe('Auth API', () => {
  const fastify = Fastify();

  before(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    await initDb(':memory:');
    await fastify.register(authPlugin);
    await fastify.register(authRoutes, { signIn: mockSignInSuccess });
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  // ─── US1: POST /auth/google ─────────────────────────────────────────────────

  describe('POST /auth/google', () => {
    test('happy path: returns 200 with token and user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { idToken: 'valid-google-id-token' },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json<{ token: string; user: { id: string; email: string } }>();
      assert.ok(body.token, 'should have token');
      assert.equal(body.user.email, 'user@gmail.com');
    });

    test('returns 400 when idToken is missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/google',
        payload: {},
      });

      assert.equal(response.statusCode, 400);
    });
  });

  // ─── POST /auth/google with failure mock ────────────────────────────────────

  describe('POST /auth/google (failure cases)', () => {
    const failFastify = Fastify();

    before(async () => {
      await failFastify.register(authPlugin);
      await failFastify.register(authRoutes, { signIn: mockSignInFailure });
      await failFastify.ready();
    });

    after(async () => {
      await failFastify.close();
    });

    test('returns 401 INVALID_GOOGLE_TOKEN for bad token', async () => {
      const response = await failFastify.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { idToken: 'not-a-real-token' },
      });

      assert.equal(response.statusCode, 401);
      const body = response.json<{ code: string }>();
      assert.equal(body.code, 'INVALID_GOOGLE_TOKEN');
    });
  });

  // ─── US1: GET /auth/me (authenticated) ─────────────────────────────────────

  describe('GET /auth/me (authenticated)', () => {
    test('returns 200 with authenticated identity when valid Bearer token present', async () => {
      // Insert a real user in the in-memory DB and issue a real JWT for them.
      const user = await upsertUser({
        googleSub: 'auth-me-test-sub',
        email: 'authme@gmail.com',
        displayName: 'Auth Me',
        avatarUrl: null,
      });
      const token = issueToken(user.id, TEST_SECRET);

      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json<{ kind: string; user: { email: string } }>();
      assert.equal(body.kind, 'authenticated');
      assert.equal(body.user.email, 'authme@gmail.com');
    });
  });

  // ─── US2: GET /auth/me (guest) ──────────────────────────────────────────────

  describe('GET /auth/me (guest)', () => {
    test('returns 200 with guest identity when no Authorization header', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/auth/me' });

      assert.equal(response.statusCode, 200);
      const body = response.json<{ kind: string }>();
      assert.equal(body.kind, 'guest');
    });

    test('returns 200 with guest identity when Authorization header is malformed', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'not-a-bearer-token' },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json<{ kind: string }>();
      assert.equal(body.kind, 'guest');
    });

    test('returns 200 with guest identity when Bearer token is invalid', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'Bearer invalid.token.here' },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json<{ kind: string }>();
      assert.equal(body.kind, 'guest');
    });
  });

  // ─── US3: POST /auth/signout ─────────────────────────────────────────────────

  describe('POST /auth/signout', () => {
    test('returns 204 with valid Bearer token', async () => {
      const user = await upsertUser({
        googleSub: 'signout-test-sub',
        email: 'signout@gmail.com',
        displayName: 'Sign Out User',
        avatarUrl: null,
      });
      const token = issueToken(user.id, TEST_SECRET);

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/signout',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 204);
    });

    test('returns 204 even with no Authorization header (server-side no-op)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/signout',
      });

      assert.equal(response.statusCode, 204);
    });
  });
});
