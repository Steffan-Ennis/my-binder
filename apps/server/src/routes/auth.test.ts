import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { DataSource } from 'typeorm';

import { connectTestDatabase, disconnectTestDatabase } from '@root/testing/testDatabase';
import { aUser } from '@root/testing/userEntityBuilder';
import authPlugin from '@src/auth/authPlugin';
import { authRoutes } from '@src/routes/auth';
import { issueToken } from '@src/auth/sessionJwt';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';
const VALID_ID_TOKEN = 'valid-google-id-token';
const ALLOWED_EMAIL = 'allowed-user@gmail.com';
const ALLOWED_NAME = 'Allowed User';
const NOT_ALLOWED_ID_TOKEN = 'not-allowed-google-id-token';
const NOT_ALLOWED_EMAIL = 'not-allowed@gmail.com';

const mockVerifyIdToken = jest.fn(({ idToken }: { idToken: string }) => {
  if (idToken === VALID_ID_TOKEN) {
    return {
      getPayload: () => ({
        sub: 'google',
        email: ALLOWED_EMAIL,
        email_verified: true,
        name: ALLOWED_NAME,
        picture: '',
      }),
    };
  }
  if (idToken === NOT_ALLOWED_ID_TOKEN) {
    return {
      getPayload: () => ({
        sub: 'google',
        email: NOT_ALLOWED_EMAIL,
        email_verified: true,
        name: 'No Access',
        picture: '',
      }),
    };
  }
  return { getPayload: () => undefined };
});

jest.mock('google-auth-library', () => {
  function OAuth2Client() {}
  OAuth2Client.prototype.verifyIdToken = (...args: unknown[]) =>
    mockVerifyIdToken(...(args as [{ idToken: string }]));
  return { OAuth2Client };
});

describe('Auth API', () => {
  const fastify = Fastify();
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';

    dataSource = await connectTestDatabase();
    await aUser()
      .withEmail(ALLOWED_EMAIL)
      .isAllowed()
      .persist(dataSource)

    const { signIn } = await import('@src/services/authService');
    await fastify.register(fastifyCookie);
    await fastify.register(authPlugin);
    await fastify.register(authRoutes, { signIn });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    await disconnectTestDatabase();
    jest.restoreAllMocks();
  });

  test('POST /auth/google returns 200 with token and user for a valid allowlisted token', async () => {
    const r = await fastify.inject({
      method: 'POST', url: '/auth/google', payload: { idToken: VALID_ID_TOKEN },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ token: string; user: { id: string; email: string } }>();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe(ALLOWED_EMAIL);
    expect(mockVerifyIdToken).toHaveBeenCalled();
  });

  test('POST /auth/google returns 400 when idToken is missing', async () => {
    const r = await fastify.inject({ method: 'POST', url: '/auth/google', payload: {} });
    expect(r.statusCode).toBe(400);
  });

  test('POST /auth/google returns 401 INVALID_GOOGLE_TOKEN for an unverifiable token', async () => {
    const r = await fastify.inject({
      method: 'POST', url: '/auth/google', payload: { idToken: 'not-a-real-token' },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json<{ code: string }>().code).toBe('INVALID_GOOGLE_TOKEN');
  });

  test('POST /auth/google returns 403 UNAUTHORIZED when the email is not on the allowlist', async () => {
    const r = await fastify.inject({
      method: 'POST', url: '/auth/google', payload: { idToken: NOT_ALLOWED_ID_TOKEN },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json<{ code: string }>().code).toBe('UNAUTHORIZED');
  });

  test('GET /auth/me returns 200 with authenticated identity for a valid Bearer token', async () => {
    const user = await aUser()
      .withEmail('me-test@gmail.com')
      .withDisplayName('Me Test')
      .persist(dataSource);
    const token = issueToken(user.id, TEST_SECRET);

    const r = await fastify.inject({
      method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json<{ kind: string; user: { email: string } }>();
    expect(body.kind).toBe('authenticated');
    expect(body.user.email).toBe('me-test@gmail.com');
  });

  test('GET /auth/me returns 200 with guest identity when no Authorization header is sent', async () => {
    const r = await fastify.inject({ method: 'GET', url: '/auth/me' });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ kind: string }>().kind).toBe('guest');
  });

  test('GET /auth/me returns 200 with guest identity when Authorization header is malformed', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/auth/me', headers: { authorization: 'not-a-bearer-token' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ kind: string }>().kind).toBe('guest');
  });

  test('GET /auth/me returns 200 with guest identity when Bearer token is invalid', async () => {
    const r = await fastify.inject({
      method: 'GET', url: '/auth/me', headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ kind: string }>().kind).toBe('guest');
  });

  test('POST /auth/signout returns 204 with a valid Bearer token', async () => {
    const user = await aUser().persist(dataSource);
    const token = issueToken(user.id, TEST_SECRET);

    const r = await fastify.inject({
      method: 'POST', url: '/auth/signout', headers: { authorization: `Bearer ${token}` },
    });
    expect(r.statusCode).toBe(204);
  });

  test('POST /auth/signout returns 204 even without an Authorization header', async () => {
    const r = await fastify.inject({ method: 'POST', url: '/auth/signout' });
    expect(r.statusCode).toBe(204);
  });
});
