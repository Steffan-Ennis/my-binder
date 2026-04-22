import type { AuthUser, GoogleSignInResponse } from '@my-binder/core';
import type { OAuth2Client } from 'google-auth-library';
import { verifyGoogleToken } from '@src/auth/googleVerifier';
import { issueToken } from '@src/auth/sessionJwt';
import { getRepositories } from '@src/db/repositories';
import type { AllowedUserRepository } from '@src/repositories/allowedUserRepository';
import type { UserRepository } from '@src/repositories/userRepository';
import { getAuthConfig } from '@src/auth/authConfig';

export class InvalidGoogleTokenError extends Error {
  constructor(cause?: unknown) {
    const msg = cause instanceof Error ? cause.message : 'Google ID token verification failed.';
    super(msg);
    this.name = 'InvalidGoogleTokenError';
  }
}

export class AccessDeniedError extends Error {
  constructor() {
    super('This email address is not permitted to sign in.');
    this.name = 'AccessDeniedError';
  }
}

type SignInDeps = {
  googleClient?: OAuth2Client;
  /** Test injection: override the allowlist repository. */
  allowedUserRepo?: AllowedUserRepository;
  /** Test injection: override the user repository. */
  userRepo?: UserRepository;
};

/**
 * Orchestrate Google sign-in:
 *   1. Verify the Google ID token (rejects expired, wrong audience, unverified email)
 *   2. Check email against the allowlist — throws AccessDeniedError if not found
 *   3. Upsert the user in PostgreSQL (idempotent on email)
 *   4. Issue a server-side session JWT
 *
 * Throws InvalidGoogleTokenError if the Google token is invalid for any reason.
 * Throws AccessDeniedError if the email is not on the allowlist.
 */
export async function signIn(
  idToken: string,
  deps: SignInDeps = {},
): Promise<GoogleSignInResponse> {
  const { googleClientIds, sessionJwtSecret } = await getAuthConfig();
  const _allowedUserRepo = deps.allowedUserRepo ?? getRepositories().allowedUser;
  const _userRepo = deps.userRepo ?? getRepositories().user;
  let user: AuthUser;
  try {
    const payload = await verifyGoogleToken(idToken, googleClientIds, deps.googleClient);

    const allowedUser = await _allowedUserRepo.findByEmail(payload.email);
    if (!allowedUser) {
      throw new AccessDeniedError();
    }

    user = await _userRepo.upsertUser({
      email: payload.email,
      displayName: payload.name,
      avatarUrl: payload.picture ?? null,
    });
  } catch (err) {
    if (err instanceof AccessDeniedError) throw err;
    if (err instanceof InvalidGoogleTokenError) throw err;
    throw new InvalidGoogleTokenError(err);
  }

  const token = issueToken(user.id, sessionJwtSecret);
  return { token, user };
}
