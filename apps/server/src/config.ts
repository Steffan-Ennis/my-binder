import { join } from 'node:path';
import { DataSourceOptions } from "typeorm";
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { resolveDbConfig, resolveDbConfigSync } from '@src/db/dbConfig';
import type {DataInitialiseOptions} from "@src/db/dataSource";

export type Config = {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  cardProvider: string;
  mtgjsonCacheDir: string;
  // PostgreSQL connection config
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDatabase: string;
  pgSsl?: DataInitialiseOptions['ssl'];

  // DatabaseType
  dbType?: DataSourceOptions['type'],
};

// Set once by loadConfig() after secrets are resolved; read everywhere via getConfig().
let _config: Config | null = null;

/**
 * Return the current config.
 *
 * - If loadConfig() has already been called (production / integrated startup):
 *   returns the cached result.
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
 * Load config at server startup. Resolves DB credentials from Secrets Manager
 * when *_SECRET_NAME env vars are present (production Lambda); falls back to
 * reading values directly from env vars (local dev / CI).
 *
 * Auth secrets (session JWT, Google client IDs) are handled separately by
 * `@src/auth/authConfig` and resolved lazily on first use.
 *
 * Stores the result in a module-level singleton so subsequent getConfig() calls
 * return the same already-resolved values without hitting Secrets Manager again.
 */
export async function loadConfig(): Promise<Config> {
  const dbConfig = await resolveDbConfig();

  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as Config['nodeEnv'];

  _config = {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv,
    cardProvider: process.env['CARD_PROVIDER'] ?? 'mtgjson',
    mtgjsonCacheDir: process.env['EFS_PATH']
      ? join(process.env['EFS_PATH'], 'mtgjson-cache')
      : (process.env['MTGJSON_CACHE_DIR'] ?? './data/mtgjson-cache'),
    pgHost: dbConfig.host,
    pgPort: dbConfig.port,
    pgUser: dbConfig.username,
    pgPassword: dbConfig.password,
    pgDatabase: dbConfig.database,
    pgSsl: dbConfig.ssl,
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
  const dbConfig = resolveDbConfigSync();
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv,
    cardProvider: process.env['CARD_PROVIDER'] ?? 'mtgjson',
    mtgjsonCacheDir: process.env['EFS_PATH']
      ? join(process.env['EFS_PATH'], 'mtgjson-cache')
      : (process.env['MTGJSON_CACHE_DIR'] ?? './data/mtgjson-cache'),
    pgHost: dbConfig.host,
    pgPort: dbConfig.port,
    pgUser: dbConfig.username,
    pgPassword: dbConfig.password,
    pgDatabase: dbConfig.database,
    pgSsl: dbConfig.ssl,
  };
}

/**
 * Resolve a secret: if the `nameVar` env var names a Secrets Manager secret,
 * fetch it; otherwise fall back to `valueVar` env var directly.
 */
export async function resolveSecret(nameVar: string, valueVar: string): Promise<string> {
  const secretName = process.env[nameVar];
  if (secretName) {
    const client = new SecretsManagerClient({});
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    return response.SecretString ?? '';
  }
  return process.env[valueVar] ?? '';
}
