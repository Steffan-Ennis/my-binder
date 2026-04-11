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
  beforeAll(() => {
    process.env['GOOGLE_CLIENT_IDS'] = 'test-client-id';
    process.env['SESSION_JWT_SECRET'] = 'a-test-secret-that-is-at-least-32-characters-long!!';
  });

  describe('signIn', () => {
    test('returns token and user when Google token is valid and email is on allowlist', async () => {
      const client = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const result = await signIn('valid-google-id-token', { googleClient: client, ...makeDeps() });
      expect(result.token).toBeTruthy();
      expect(result.user.email).toBe('service-test@gmail.com');
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
      await expect(() => signIn('valid-token', { googleClient: client, ...deps })).rejects.toThrow(AccessDeniedError);
      expect(upsertCalled).toBe(false);
    });

    test('throws InvalidGoogleTokenError when googleVerifier rejects', async () => {
      const client = makeGoogleClient(null, new Error('Token expired'));
      await expect(
        () => signIn('bad-token', { googleClient: client, ...makeDeps() }),
      ).rejects.toThrow(InvalidGoogleTokenError);
    });

    test('second signIn with same email updates user fields', async () => {
      const client1 = makeGoogleClient(VALID_GOOGLE_PAYLOAD);
      const deps1 = makeDeps({ upsertResult: { displayName: 'Service Test User' } });
      const first = await signIn('token-1', { googleClient: client1, ...deps1 });

      const updatedPayload = { ...VALID_GOOGLE_PAYLOAD, name: 'Updated Name' };
      const client2 = makeGoogleClient(updatedPayload);
      const deps2 = makeDeps({ upsertResult: { displayName: 'Updated Name' } });
      const second = await signIn('token-2', { googleClient: client2, ...deps2 });

      expect(first.user.id).toBe(second.user.id);
      expect(second.user.displayName).toBe('Updated Name');
    });
  });
});
