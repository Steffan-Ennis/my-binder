import { OAuth2Client } from 'google-auth-library';
import { verifyGoogleToken } from './googleVerifier';

const VALID_PAYLOAD = {
  sub: 'google-sub-123',
  email: 'user@gmail.com',
  name: 'Jane Doe',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
  email_verified: true,
};

// Build a fake OAuth2Client that returns a specific payload.
function makeClient(payload: Record<string, unknown> | null, throws?: Error): OAuth2Client {
  return {
    verifyIdToken: async () => {
      if (throws) throw throws;
      return { getPayload: () => payload };
    },
  } as unknown as OAuth2Client;
}

describe('googleVerifier', () => {
  test('returns payload for a valid token with email_verified: true', async () => {
    const client = makeClient(VALID_PAYLOAD);
    const result = await verifyGoogleToken('valid-token', ['audience-id'], client);
    expect(result.sub).toBe('google-sub-123');
    expect(result.email).toBe('user@gmail.com');
    expect(result.name).toBe('Jane Doe');
    expect(result.picture).toBe('https://lh3.googleusercontent.com/photo.jpg');
  });

  test('throws when email_verified is false', async () => {
    const client = makeClient({ ...VALID_PAYLOAD, email_verified: false });
    await expect(
      () => verifyGoogleToken('token-unverified-email', ['audience-id'], client),
    ).rejects.toThrow(/email_verified/i);
  });

  test('throws when verifyIdToken rejects (expired token)', async () => {
    const client = makeClient(null, new Error('Token used too late'));
    await expect(
      () => verifyGoogleToken('expired-token', ['audience-id'], client),
    ).rejects.toThrow(Error);
  });

  test('throws when verifyIdToken rejects (wrong audience)', async () => {
    const client = makeClient(null, new Error('Wrong recipient'));
    await expect(
      () => verifyGoogleToken('wrong-audience-token', ['audience-id'], client),
    ).rejects.toThrow(Error);
  });

  test('throws when token is malformed', async () => {
    const client = makeClient(null, new Error('Invalid token'));
    await expect(
      () => verifyGoogleToken('not-a-real-token', ['audience-id'], client),
    ).rejects.toThrow(Error);
  });

  test('throws when getPayload returns null', async () => {
    const client = makeClient(null);
    await expect(
      () => verifyGoogleToken('token-null-payload', ['audience-id'], client),
    ).rejects.toThrow(Error);
  });
});
