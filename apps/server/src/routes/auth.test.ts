import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import authPlugin from '@src/auth/authPlugin';
import { authRoutes } from './auth';
import { InvalidGoogleTokenError } from '@src/services/authService';
import { issueToken } from '@src/auth/sessionJwt';
import { getDataSource, initDataSource } from "@src/db/dataSource";
import { AllowedUserEntity } from "@src/entities/AllowedUserEntity";
import { DataSource, } from "typeorm";
import { UserEntity } from "@src/entities/UserEntity";
import { initRepositories } from "@src/db/repositories";
import { type VerifyIdTokenOptions } from "google-auth-library";

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long!!';
const TEST_USER_ID = 'f353ca91-4fc5-49f2-9b9e-304f83d11914';
const ID_TOKEN = 'valid-google-id-token'
const TEST_USER_EMAIL = 'user@gmail.com'
const TEST_USER_NAME = 'test-user'
const TEST_EMAIL_VERIFIED = true

const mockSignInFailure = async (_idToken: string): Promise<never> => {
  throw new InvalidGoogleTokenError(new Error('Token is invalid'));
};

describe('Auth API', () => {
  const fastify = Fastify();
  let dataSource: DataSource
  let verifyIdTokenSpy: typeof mock.fn
  let googleMock:  ReturnType<typeof mock.module>

  verifyIdTokenSpy = mock.fn(({
    idToken: _idToken,
  }: VerifyIdTokenOptions) => {
    if(_idToken && _idToken === ID_TOKEN){
      return {
        sub: 'google',
        email: TEST_USER_EMAIL,
        email_verified: TEST_EMAIL_VERIFIED,
        name: TEST_USER_NAME,
        picture: ''
      }
    }

    return undefined
  })
  function Oauth2Client () {}
  Oauth2Client.prototype.verifyIdToken = verifyIdTokenSpy
  googleMock = mock.module('google-auth-library', {
    namedExports: {
      Oauth2Client: Oauth2Client
    },
    defaultExport: mock.fn()
  })

  before(async () => {
    await initDataSource({
      pgDatabase: 'MY-BINDER-UNIT-TEST',
      pgHost: '',
      pgUser: '',
      pgPassword: '',
      pgPort: 5432
    })

    dataSource = getDataSource()


    await dataSource.runMigrations({
      transaction: 'all'
    })

    initRepositories(dataSource)

    process.env['SESSION_JWT_SECRET'] = TEST_SECRET;
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';

    const { signIn } = await import('@src/services/authService')
    await fastify.register(fastifyCookie);
    await fastify.register(authPlugin);
    await fastify.register(authRoutes, { signIn });
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
    await getDataSource().getRepository(UserEntity).clear()
    await getDataSource().getRepository(AllowedUserEntity).clear()
    googleMock.restore()
  });

  // ─── POST /auth/google ──────────────────────────────────────────────────────

  describe('POST /auth/google', () => {
    test('happy path: returns 200 with token and user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/google',
        // Mock the module
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
      await failFastify.register(fastifyCookie);
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

  // ─── GET /auth/me (authenticated) ──────────────────────────────────────────

  describe('GET /auth/me (authenticated)', () => {
    test('returns 200 with authenticated identity when valid Bearer token present', async () => {
      const token = issueToken(TEST_USER_ID, TEST_SECRET);

      await dataSource.getRepository(UserEntity).upsert({
        id: TEST_USER_ID,
        email: 'user@gmail.com',
        displayName: 'Test-User'
      }, ['id'])

      const response = await fastify.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = response.json<{ kind: string; user: { email: string } }>();
      assert.equal(body.kind, 'authenticated');
      assert.equal(body.user.email, 'user@gmail.com');
    });
  });

  // ─── GET /auth/me (guest) ───────────────────────────────────────────────────

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

  // ─── POST /auth/signout ──────────────────────────────────────────────────────

  describe('POST /auth/signout', () => {
    test('returns 204 with valid Bearer token', async () => {
      const token = issueToken(TEST_USER_ID, TEST_SECRET);

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
