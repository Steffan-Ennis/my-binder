export type Config = {
  port: number;
  dbPath: string;
  nodeEnv: 'development' | 'test' | 'production';
  cardProvider: string;
  mtgjsonCacheDir: string;
  // Comma-separated list of Google OAuth client IDs (iOS, Android, Web).
  // Passed as `audience` to OAuth2Client.verifyIdToken() — primary defence against token substitution.
  googleClientIds: string[];
  // Web-specific OAuth client ID used by the /auth/login browser login page (GIS SDK).
  // Must also be included in googleClientIds so verifyIdToken() accepts web-issued tokens.
  googleWebClientId: string;
  // Secret for signing/verifying server-issued session JWTs. Min 32 chars.
  sessionJwtSecret: string;
};

export function loadConfig(): Config {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as Config['nodeEnv'];

  const googleClientIdsRaw = process.env['GOOGLE_CLIENT_IDS'] ?? '';
  const googleClientIds = googleClientIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const googleWebClientId = process.env['GOOGLE_WEB_CLIENT_ID'] ?? '';
  const sessionJwtSecret = process.env['SESSION_JWT_SECRET'] ?? '';

  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    // In test mode, always use in-memory DuckDB — no files written to disk.
    dbPath: nodeEnv === 'test' ? ':memory:' : (process.env['DB_PATH'] ?? './binder.duckdb'),
    nodeEnv,
    cardProvider: process.env['CARD_PROVIDER'] ?? 'mtgjson',
    // Mount this path as a persistent Docker volume to avoid re-syncing on restart.
    mtgjsonCacheDir: process.env['MTGJSON_CACHE_DIR'] ?? './data/mtgjson-cache',
    googleClientIds,
    googleWebClientId,
    sessionJwtSecret,
  };
}
