import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import type { OAuth2Client } from 'google-auth-library';
import { initDb } from '@src/db/client';
import { signIn, InvalidGoogleTokenError } from './authService';

const VALID_GOOGLE_PAYLOAD = {
  sub: 'google-sub-service-test',
  email: 'service-test@gmail.com',
  name: 'Service Test User',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
  email_verified: true,
};

function makeGoogleClient(
  payload: Record<string, unknown> | null,
  throws?: Error,
): OAuth2Client {
  return {
    verifyIdToken: async () => {
      if (throws) throw throws;
      return { getPayload: () => payload };
    },
  } as unknown as OAuth2Client;
}

describe('authService', () => {
  before(async () => {
    await initDb(':memory:');
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    process.env['SESSION_JWT_SECRET'] = 'a-test-secret-that-is-at-least-32-characters-long!!';
  });

  describe('signIn', () => {
    test('returns token and user when Google token is valid', async () => {
      const client = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const result = await signIn('valid-google-id-token', { googleClient: client });
      assert.ok(result.token, 'should return a token');
      assert.equal(result.user.email, 'service-test@gmail.com');
      assert.equal(result.user.displayName, 'Service Test User');
    });

    test('throws InvalidGoogleTokenError when googleVerifier rejects', async () => {
      const client = makeGoogleClient(null, new Error('Token expired'));
      await assert.rejects(
        () => signIn('bad-token', { googleClient: client }),
        InvalidGoogleTokenError,
      );
    });

    test('second signIn with same google_sub updates user fields', async () => {
      const firstClient = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const first = await signIn('token-1', { googleClient: firstClient });

      const updatedPayload = { ...VALID_GOOGLE_PAYLOAD, name: 'Updated Name' };
      const secondClient = makeGoogleClient(updatedPayload);
      const second = await signIn('token-2', { googleClient: secondClient });

      assert.equal(first.user.id, second.user.id, 'same user id on re-sign-in');
      assert.equal(second.user.displayName, 'Updated Name');
    });
  });
});
