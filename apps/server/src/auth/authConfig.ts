import { resolveSecret } from '@src/config';

export type AuthConfig = {
  /** Comma-separated list of Google OAuth client IDs (iOS, Android, Web). */
  googleClientIds: string[];
  /** Web-specific OAuth client ID used by the /auth/login browser login page (GIS SDK). */
  googleWebClientId: string;
  /** Secret for signing/verifying server-issued session JWTs. Min 32 chars. */
  sessionJwtSecret: string;
};

let _promise: Promise<AuthConfig> | null = null;

/**
 * Resolve auth config from Secrets Manager (production) or env vars (local/CI).
 * The result is cached after the first call — subsequent calls return the same promise.
 */
export function getAuthConfig(): Promise<AuthConfig> {
  if (!_promise) {
    _promise = resolveAuthConfig();
  }
  return _promise;
}

/**
 * Clear the cached auth config. Used by tests so each test block can set
 * its own env vars and get a fresh config.
 */
export function resetAuthConfig(): void {
  _promise = null;
}

async function resolveAuthConfig(): Promise<AuthConfig> {
  const [sessionJwtSecret, googleClientIdsRaw, googleWebClientId] = await Promise.all([
    resolveSecret('SESSION_JWT_SECRET_NAME', 'SESSION_JWT_SECRET'),
    resolveSecret('GOOGLE_CLIENT_IDS_SECRET_NAME', 'GOOGLE_CLIENT_IDS'),
    resolveSecret('GOOGLE_WEB_CLIENT_ID_SECRET_NAME', 'GOOGLE_WEB_CLIENT_ID'),
  ]);

  return {
    googleClientIds: googleClientIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    googleWebClientId,
    sessionJwtSecret,
  };
}
