import { join } from 'node:path';
import { DataSourceOptions } from "typeorm";
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export type Config = {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  cardProvider: string;
  mtgjsonCacheDir: string;
  // Comma-separated list of Google OAuth client IDs (iOS, Android, Web).
  googleClientIds: string[];
  // Web-specific OAuth client ID used by the /auth/login browser login page (GIS SDK).
  googleWebClientId: string;
  // Secret for signing/verifying server-issued session JWTs. Min 32 chars.
  sessionJwtSecret: string;
  // PostgreSQL connection config
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDatabase: string;

  // DatabaseType
  dbType?: DataSourceOptions['type'],
};

// Set once by loadConfig() after secrets are resolved; read everywhere via getConfig().
let _config: Config | null = null;

/**
 * Return the current config.
 *
 * - If loadConfig() has already been called (production / integrated startup):
 *   returns the cached result, which includes secrets fetched from Secrets Manager.
 * - Otherwise (unit tests that register routes directly without calling buildApp()):
 *   reads env vars synchronously on every call WITHOUT caching, so that each
 *   describe block's before() hook can set its own env vars freely.
 */
export function getConfig(): Config {
  if (_config !== null) return _config;
  // Uncached fallback — used by tests that never call loadConfig().
  return buildConfigFromEnv();
}

/**
 * Load config at server startup. Fetches secrets from AWS Secrets Manager when
 * *_SECRET_NAME env vars are present (production Lambda); falls back to reading
 * values directly from the corresponding env vars (local dev / CI).
 *
 * Stores the result in a module-level singleton so subsequent getConfig() calls
 * return the same already-resolved values without hitting Secrets Manager again.
 */
export async function loadConfig(): Promise<Config> {
  const [sessionJwtSecret, googleClientIdsRaw, googleWebClientId, pgPassword] = await Promise.all([
    resolveSecret('SESSION_JWT_SECRET_NAME', 'SESSION_JWT_SECRET'),
    resolveSecret('GOOGLE_CLIENT_IDS_SECRET_NAME', 'GOOGLE_CLIENT_IDS'),
    resolveSecret('GOOGLE_WEB_CLIENT_ID_SECRET_NAME', 'GOOGLE_WEB_CLIENT_ID'),
    resolveSecret('DATABASE_SECRET_NAME', 'DATABASE_PASSWORD'),
  ]);

  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as Config['nodeEnv'];

  _config = {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv,
    cardProvider: process.env['CARD_PROVIDER'] ?? 'mtgjson',
    mtgjsonCacheDir: process.env['EFS_PATH']
      ? join(process.env['EFS_PATH'], 'mtgjson-cache')
      : (process.env['MTGJSON_CACHE_DIR'] ?? './data/mtgjson-cache'),
    googleClientIds: googleClientIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    googleWebClientId,
    sessionJwtSecret,
    pgHost: process.env['DATABASE_URL'] ?? 'localhost',
    pgPort: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
    pgUser: process.env['DATABASE_USER'] ?? 'postgres',
    pgPassword,
    pgDatabase: process.env['DATABASE_NAME'] ?? 'my_binder',
  };

  return _config;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build config purely from env vars — no async I/O, no Secrets Manager.
 * Used as the uncached fallback in getConfig() for test environments.
 */
function buildConfigFromEnv(): Config {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as Config['nodeEnv'];
  const googleClientIdsRaw = process.env['GOOGLE_CLIENT_IDS'] ?? '';
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv,
    cardProvider: process.env['CARD_PROVIDER'] ?? 'mtgjson',
    mtgjsonCacheDir: process.env['EFS_PATH']
      ? join(process.env['EFS_PATH'], 'mtgjson-cache')
      : (process.env['MTGJSON_CACHE_DIR'] ?? './data/mtgjson-cache'),
    googleClientIds: googleClientIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    googleWebClientId: process.env['GOOGLE_WEB_CLIENT_ID'] ?? '',
    sessionJwtSecret: process.env['SESSION_JWT_SECRET'] ?? '',
    pgHost: process.env['DATABASE_URL'] ?? 'localhost',
    pgPort: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
    pgUser: process.env['DATABASE_USER'] ?? 'postgres',
    pgPassword: process.env['DATABASE_PASSWORD'] ?? '',
    pgDatabase: process.env['DATABASE_NAME'] ?? 'my_binder',
  };
}

/**
 * Resolve a secret: if the `nameVar` env var names a Secrets Manager secret,
 * fetch it; otherwise fall back to `valueVar` env var directly.
 */
async function resolveSecret(nameVar: string, valueVar: string): Promise<string> {
  const secretName = process.env[nameVar];
  if (secretName) {
    const client = new SecretsManagerClient({});
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    return response.SecretString ?? '';
  }
  return process.env[valueVar] ?? '';
}
