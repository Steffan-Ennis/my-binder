import type { AuthUser, GoogleSignInResponse } from '@my-binder/core';
import type { OAuth2Client } from 'google-auth-library';
import { verifyGoogleToken } from '@src/auth/googleVerifier';
import { issueToken } from '@src/auth/sessionJwt';
import { getRepositories } from '@src/db/repositories';
import type { AllowedUserRepository } from '@src/repositories/allowedUserRepository';
import type { UserRepository } from '@src/repositories/userRepository';
import { getAuthConfig } from '@src/auth/authConfig';

/**
 * Thrown when the Google ID token cannot be verified — bad signature, wrong
 * audience, expired, unverified email, or any non-`AccessDeniedError` failure
 * during the sign-in pipeline. Always surfaces as HTTP 401 to the caller.
 *
 * The original cause is preserved as the `Error.message` when one is
 * available, so server logs see the underlying reason; the HTTP layer must
 * not echo the message verbatim to clients (auth-error opacity).
 *
 * @example
 * ```ts
 * try {
 *   await signIn(idToken);
 * } catch (err) {
 *   if (err instanceof InvalidGoogleTokenError) {
 *     reply.code(401).send({ error: 'INVALID_GOOGLE_TOKEN', message: 'Sign-in failed.' });
 *   }
 * }
 * ```
 */
export class InvalidGoogleTokenError extends Error {
  constructor(cause?: unknown) {
    const msg = cause instanceof Error ? cause.message : 'Google ID token verification failed.';
    super(msg);
    this.name = 'InvalidGoogleTokenError';
  }
}

/**
 * Thrown when Google verifies the user successfully but their email is not on
 * the allowlist. Distinct from `InvalidGoogleTokenError` so the HTTP layer can
 * map this to 403 (forbidden) rather than 401 (unauthenticated).
 *
 * @example
 * ```ts
 * try {
 *   await signIn(idToken);
 * } catch (err) {
 *   if (err instanceof AccessDeniedError) {
 *     reply.code(403).send({ error: 'ACCESS_DENIED', message: err.message });
 *   }
 * }
 * ```
 */
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
 * Orchestrate a Google sign-in end-to-end:
 *
 *   1. Verify the Google ID token (rejects expired tokens, wrong audience,
 *      unverified email).
 *   2. Look up the verified email in the allowlist; reject if absent.
 *   3. Upsert the user in PostgreSQL — idempotent on email so the same caller
 *      across logins yields the same `AuthUser.id`.
 *   4. Issue a server-side session JWT (HS256, 7-day TTL by default).
 *
 * Any non-allowlist failure inside the verify-and-upsert block is wrapped in
 * `InvalidGoogleTokenError` so the HTTP layer can return a single 401 shape
 * regardless of the underlying cause. The `AccessDeniedError` is intentionally
 * re-raised unwrapped because it must map to 403, not 401.
 *
 * @param idToken - The Google-issued ID token from the browser sign-in flow.
 * @param deps - Optional test injection points.
 * @param deps.googleClient - Substitute Google OAuth2 client (used by tests to bypass network).
 * @param deps.allowedUserRepo - Substitute allowlist repository.
 * @param deps.userRepo - Substitute user repository.
 * @returns `{ token, user }` — a session JWT plus the upserted `AuthUser` row.
 * @throws InvalidGoogleTokenError when the token fails verification or any underlying repository call throws.
 * @throws AccessDeniedError when verification succeeds but the email is not on the allowlist.
 *
 * @example
 * ```ts
 * // Production path — uses live repositories and Google client.
 * const { token, user } = await signIn(idTokenFromBrowser);
 *
 * // Test path — inject mocks.
 * const { token, user } = await signIn(idTokenFromBrowser, {
 *   googleClient: mockGoogleClient,
 *   allowedUserRepo: { findByEmail: async () => ({ email: 'me@example.com' }) },
 *   userRepo: { upsertUser: async (u) => ({ id: 'u_1', ...u }) },
 * });
 * ```
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