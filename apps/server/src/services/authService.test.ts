import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import type { OAuth2Client } from 'google-auth-library';
import type { AuthUser } from '@my-binder/core';
import { signIn, InvalidGoogleTokenError, AccessDeniedError } from './authService';
import type { AllowedUserRepository } from '@src/repositories/allowedUserRepository';
import type { UserRepository } from '@src/repositories/userRepository';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function makeDeps(overrides: {
  allowlisted?: boolean;
  upsertResult?: Partial<AuthUser>;
} = {}) {
  const baseUser: AuthUser = {
    id: 'user-uuid-1',
    email: 'service-test@gmail.com',
    displayName: 'Service Test User',
    avatarUrl: null,
  };
  return {
    allowedUserRepo: {
      findByEmail: async (_email: string) =>
        overrides.allowlisted === false ? null : ({ email: _email }),
    } as unknown as AllowedUserRepository,
    userRepo: {
      upsertUser: async (_input: unknown) => ({ ...baseUser, ...overrides.upsertResult }),
    } as unknown as UserRepository,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('authService', () => {
  before(() => {
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    process.env['SESSION_JWT_SECRET'] = 'a-test-secret-that-is-at-least-32-characters-long!!';
  });

  describe('signIn', () => {
    test('returns token and user when Google token is valid and email is on allowlist', async () => {
      const client = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const result = await signIn('valid-google-id-token', { googleClient: client, ...makeDeps() });
      assert.ok(result.token, 'should return a token');
      assert.equal(result.user.email, 'service-test@gmail.com');
    });

    test('throws AccessDeniedError when email is not on allowlist — upsertUser NOT called', async () => {
      let upsertCalled = false;
      const client = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const deps = {
        allowedUserRepo: {
          findByEmail: async () => null,
        } as unknown as AllowedUserRepository,
        userRepo: {
          upsertUser: async (_input: unknown) => { upsertCalled = true; return {} as AuthUser; },
        } as unknown as UserRepository,
      };
      await assert.rejects(() => signIn('valid-token', { googleClient: client, ...deps }), AccessDeniedError);
      assert.equal(upsertCalled, false, 'upsertUser must not be called');
    });

    test('throws InvalidGoogleTokenError when googleVerifier rejects', async () => {
      const client = makeGoogleClient(null, new Error('Token expired'));
      await assert.rejects(
        () => signIn('bad-token', { googleClient: client, ...makeDeps() }),
        InvalidGoogleTokenError,
      );
    });

    test('second signIn with same email updates user fields', async () => {
      const client1 = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const deps1 = makeDeps({ upsertResult: { displayName: 'Service Test User' } });
      const first = await signIn('token-1', { googleClient: client1, ...deps1 });

      const updatedPayload = { ...VALID_GOOGLE_PAYLOAD, name: 'Updated Name' };
      const client2 = makeGoogleClient(updatedPayload);
      const deps2 = makeDeps({ upsertResult: { displayName: 'Updated Name' } });
      const second = await signIn('token-2', { googleClient: client2, ...deps2 });

      assert.equal(first.user.id, second.user.id, 'same user id on re-sign-in');
      assert.equal(second.user.displayName, 'Updated Name');
    });
  });
});
