import type { AuthUser, GoogleSignInResponse } from '@my-binder/core';
import type { OAuth2Client } from 'google-auth-library';
import { verifyGoogleToken } from '@src/auth/googleVerifier';
import { issueToken } from '@src/auth/sessionJwt';
import { upsertUser } from '@src/repositories/userRepository';
import { getConfig } from '@src/config';

export class InvalidGoogleTokenError extends Error {
  constructor(cause?: unknown) {
    const msg = cause instanceof Error ? cause.message : 'Google ID token verification failed.';
    super(msg);
    this.name = 'InvalidGoogleTokenError';
  }
}

type SignInDeps = {
  googleClient?: OAuth2Client;
};

/**
 * Orchestrate Google sign-in:
 *   1. Verify the Google ID token (rejects expired, wrong audience, unverified email)
 *   2. Upsert the user in DuckDB (idempotent on google_sub)
 *   3. Issue a server-side session JWT
 *
 * Throws InvalidGoogleTokenError if the Google token is invalid for any reason.
 * Follows the same pattern as cardService.ts.
 *
 * The optional `deps` parameter allows test injection of a mock OAuth2Client.
 */
export async function signIn(
  idToken: string,
  deps: SignInDeps = {},
): Promise<GoogleSignInResponse> {
  const { googleClientIds, sessionJwtSecret } = getConfig();

  let user: AuthUser;
  try {
    const payload = await verifyGoogleToken(idToken, googleClientIds, deps.googleClient);
    user = await upsertUser({
      googleSub: payload.sub,
      email: payload.email,
      displayName: payload.name,
      avatarUrl: payload.picture ?? null,
    });
  } catch (err) {
    if (err instanceof InvalidGoogleTokenError) throw err;
    throw new InvalidGoogleTokenError(err);
  }

  const token = issueToken(user.id, sessionJwtSecret);
  return { token, user };
}
