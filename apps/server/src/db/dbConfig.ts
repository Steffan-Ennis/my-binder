import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export type DbConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

/**
 * Secret JSON shape stored by `rds.DatabaseSecret`.
 * Keys: dbClusterIdentifier, password, dbname, engine, port, host, username.
 */
interface RdsSecret {
  password?: string;
  dbname?: string;
  port?: number;
  host?: string;
  username?: string;
}

const DEFAULTS: DbConfig = {
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '',
  database: 'my_binder',
};

/**
 * Resolve database connection details.
 *
 * Priority per field: RDS secret value > process.env value > default.
 *
 * When `DATABASE_SECRET_NAME` is set (Lambda), the secret JSON is fetched from
 * Secrets Manager and each field is extracted. Any field missing from the secret
 * falls back to the corresponding env var, then to a hardcoded default.
 *
 * When `DATABASE_SECRET_NAME` is not set (local dev / CI), only env vars and
 * defaults are used.
 */
export async function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): Promise<DbConfig> {
  const secret = await fetchRdsSecret(env);

  return {
    host: secret?.host ?? env['DATABASE_URL'] ?? DEFAULTS.host,
    port: secret?.port ?? parseInt(env['DATABASE_PORT'] ?? String(DEFAULTS.port), 10),
    username: secret?.username ?? env['DATABASE_USER'] ?? DEFAULTS.username,
    password: secret?.password ?? env['DATABASE_PASSWORD'] ?? DEFAULTS.password,
    database: secret?.dbname ?? env['DATABASE_NAME'] ?? DEFAULTS.database,
  };
}

/**
 * Build a DbConfig synchronously from env vars only (no Secrets Manager).
 * Used by getConfig() for the uncached test fallback path.
 */
export function resolveDbConfigSync(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    host: env['DATABASE_URL'] ?? DEFAULTS.host,
    port: parseInt(env['DATABASE_PORT'] ?? String(DEFAULTS.port), 10),
    username: env['DATABASE_USER'] ?? DEFAULTS.username,
    password: env['DATABASE_PASSWORD'] ?? DEFAULTS.password,
    database: env['DATABASE_NAME'] ?? DEFAULTS.database,
  };
}

async function fetchRdsSecret(env: NodeJS.ProcessEnv): Promise<RdsSecret | null> {
  const secretName = env['DATABASE_SECRET_NAME'];
  if (!secretName) return null;

  const client = new SecretsManagerClient({});
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  if (!response.SecretString) return null;

  try {
    return JSON.parse(response.SecretString) as RdsSecret;
  } catch {
    return null;
  }
}
