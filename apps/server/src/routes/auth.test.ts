import 'reflect-metadata';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import authPlugin from '@src/auth/authPlugin';
import { InvalidGoogleTokenError } from '@src/services/authService';
import { issueToken } from '@src/auth/sessionJwt';
import { getDataSource, initDataSource } from '@src/db/dataSource';
import { AllowedUserEntity } from '@src/entities/AllowedUserEntity';
import { DataSource } from 'typeorm';
import { UserEntity } from '@src/entities/UserEntity';
import { initRepositories } from '@src/db/repositories';
import { authRoutes } from '@src/routes/auth';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';
const TEST_USER_ID = 'f353ca91-4fc5-49f2-9b9e-304f83d11914';
const ID_TOKEN = 'valid-google-id-token';
const TEST_USER_EMAIL = 'user@gmail.com';
const TEST_USER_NAME = 'test-user';
const TEST_EMAIL_VERIFIED = true;

const mockVerifyIdToken = jest.fn(({ idToken: _idToken }: { idToken: string }) => {
  if (_idToken && _idToken === ID_TOKEN) {
    return {
      getPayload: () => ({
        sub: 'google',
        email: TEST_USER_EMAIL,
        email_verified: TEST_EMAIL_VERIFIED,
        name: TEST_USER_NAME,
        picture: '',
      }),
    };
  }
  return { getPayload: () => undefined };
});

jest.mock('google-auth-library', () => {
  function OAuth2Client() {}
  OAuth2Client.prototype.verifyIdToken = (...args: unknown[]) => mockVerifyIdToken(...(args as [{ idToken: string }]));
  return { OAuth2Client };
});

const mockSignInFailure = async (_idToken: string): Promise<never> => {
  throw new InvalidGoogleTokenError(new Error('Token is invalid'));
};

describe('Auth API', () => {
  const fastify = Fastify();
  let dataSource: DataSource;

  beforeAll(async () => {
    await initDataSource({
      pgDatabase: 'MY-BINDER-UNIT-TEST',
      pgHost: '',
      pgUser: '',
      pgPassword: '',
      pgPort: 5432,
    });

    dataSource = getDataSource();

    await dataSource.runMigrations({
      transaction: 'all',
    });

    initRepositories(dataSource);

    // Seed the allowlist so signIn does not reject with AccessDeniedError
    await dataSource.getRepository(AllowedUserEntity).save({ email: TEST_USER_EMAIL });

    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';

    const { signIn } = await import('@src/services/authService');
    await fastify.register(fastifyCookie);
    await fastify.register(authPlugin);
    await fastify.register(authRoutes, { signIn });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    const ds = getDataSource();
    await ds.query('TRUNCATE TABLE "allowed_user_entity", "users" CASCADE');
    await ds.destroy();
    jest.restoreAllMocks();
  });

  // ─── POST /auth/google ──────────────────────────────────────────────────────

  describe('POST /auth/google', () => {
    test('happy path: returns 200 with token and user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { idToken: 'valid-google-id-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ token: string; user: { id: string; email: string } }>();
      expect(body.token).toBeTruthy();
      expect(body.user.email).toBe('user@gmail.com');
      // KEY VALIDATION: verify the mock spy was actually called
      expect(mockVerifyIdToken.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    test('returns 400 when idToken is missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/google',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ─── POST /auth/google with failure mock ────────────────────────────────────

  describe('POST /auth/google (failure cases)', () => {
    const failFastify = Fastify();

    beforeAll(async () => {
      await failFastify.register(fastifyCookie);
      await failFastify.register(authPlugin);
      await failFastify.register(authRoutes, { signIn: mockSignInFailure });
      await failFastify.ready();
    });

    afterAll(async () => {
      await failFastify.close();
    });

    test('returns 401 INVALID_GOOGLE_TOKEN for bad token', async () => {
      const response = await failFastify.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { idToken: 'not-a-real-token' },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<{ code: string }>();
      expect(body.code).toBe('INVALID_GOOGLE_TOKEN');
    });
  });

  // ─── GET /auth/me (authenticated) ──────────────────────────────────────────

  describe('GET /auth/me (authenticated)', () => {
    test('returns 200 with authenticated identity when valid Bearer token present', async () => {
      const token = issueToken(TEST_USER_ID, TEST_SECRET);

      await dataSource.getRepository(UserEntity).upsert({
        id: TEST_USER_ID,
        email: 'user@gmail.com',
        displayName: 'Test-User',
      }, ['email']);

      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ kind: string; user: { email: string } }>();
      expect(body.kind).toBe('authenticated');
      expect(body.user.email).toBe('user@gmail.com');
    });
  });

  // ─── GET /auth/me (guest) ───────────────────────────────────────────────────

  describe('GET /auth/me (guest)', () => {
    test('returns 200 with guest identity when no Authorization header', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/auth/me' });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ kind: string }>();
      expect(body.kind).toBe('guest');
    });

    test('returns 200 with guest identity when Authorization header is malformed', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'not-a-bearer-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ kind: string }>();
      expect(body.kind).toBe('guest');
    });

    test('returns 200 with guest identity when Bearer token is invalid', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'Bearer invalid.token.here' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{ kind: string }>();
      expect(body.kind).toBe('guest');
    });
  });

  // ─── POST /auth/signout ──────────────────────────────────────────────────────

  describe('POST /auth/signout', () => {
    test('returns 204 with valid Bearer token', async () => {
      const token = issueToken(TEST_USER_ID, TEST_SECRET);

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/signout',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(204);
    });

    test('returns 204 even with no Authorization header (server-side no-op)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/signout',
      });

      expect(response.statusCode).toBe(204);
    });
  });
});
