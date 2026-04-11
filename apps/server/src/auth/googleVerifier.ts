export type GoogleTokenPayload = {
  sub: string;
  email: string;
  name: string;
  picture: string | undefined;
  email_verified: boolean;
};

/**
 * Verify a Google ID token against the provided audience list.
 *
 * Passes the full clientIds list as `audience` to defend against token substitution attacks.
 * Rejects tokens where `email_verified` is false.
 * Throws on any verification failure — callers must catch and map to HTTP 401.
 *
 * The optional `client` parameter allows test injection of a mock OAuth2Client.
 */
export async function verifyGoogleToken(
  idToken: string,
  clientIds: string[],
  injectedClient?: import('google-auth-library').OAuth2Client,
): Promise<GoogleTokenPayload> {
  const client = injectedClient ?? new (await import('google-auth-library')).OAuth2Client()

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientIds,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Google ID token payload is null');
  }

  if (!payload['email_verified']) {
    throw new Error('Google ID token rejected: email_verified is false');
  }

  return {
    sub: payload['sub'] as string,
    email: payload['email'] as string,
    name: (payload['name'] ?? '') as string,
    picture: payload['picture'] as string | undefined,
    email_verified: payload['email_verified'] as boolean,
  };
}
