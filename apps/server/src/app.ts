import Fastify, { FastifyInstance } from 'fastify';
import fastifyCaching from '@fastify/caching';
import fastifyCookie from '@fastify/cookie';
import { MtgjsonSDK } from 'mtgjson-sdk';
import { loadConfig, type Config } from '@src/config';
import { initDataSource, getDataSource } from '@src/db/dataSource';
import { initRepositories } from '@src/db/repositories';
import { appCache } from '@src/db/cache';
import { reposPlugin } from '@src/plugins/reposPlugin';
import { healthRoutes } from '@src/routes/health';
import { cardRoutes } from '@src/routes/cards';
import { providerRoutes } from '@src/routes/provider';
import { authRoutes } from '@src/routes/auth';
import { loginRoutes } from '@src/routes/login';
import { docsPlugin } from '@src/routes/docs';
import authPlugin from '@src/auth/authPlugin';
import { MtgjsonProvider } from '@src/providers/mtgjson/index';
import { registry } from '@src/providers/registry';
import { initEfs } from '@src/services/efsService';

export type AppResult = { fastify: FastifyInstance; config: Config };

export async function buildApp(): Promise<AppResult> {
  // 0. Load config — fetches secrets from Secrets Manager in production.
  const config = await loadConfig();

  // 1. Ensure EFS subdirectories exist (Lambda only — no-op locally).
  if (process.env['EFS_PATH']) {
    await initEfs(process.env['EFS_PATH']);
  }

  // 2. Initialise PostgreSQL DataSource.
  await initDataSource({
    pgPort: config.pgPort,
    pgPassword: config.pgPassword,
    pgUser: config.pgUser,
    pgDatabase: config.pgDatabase,
    pgHost: config.pgHost
  });

  // 3. Initialise repository singletons — must run after DataSource is ready.
  initRepositories(getDataSource());

  // 4. Initialise MTGJSON SDK — downloads parquet files on first cold start,
  //    reads from EFS cache on subsequent starts.
  const sdk = await MtgjsonSDK.create({ cacheDir: config.mtgjsonCacheDir });

  // 5. Register the card provider backed by the SDK.
  const mtgjsonProvider = new MtgjsonProvider(sdk);
  registry.register('mtgjson', mtgjsonProvider);
  await registry.setActive(config.cardProvider);

  // 6. Build the Fastify instance.
  const fastify = Fastify({ logger: true });

  // Cache plugin must be registered early — sets Cache-Control headers via middleware.
  await fastify.register(fastifyCaching, {
    privacy: fastifyCaching.privacy.PRIVATE,
    expiresIn: 300,
    cache: appCache,
  });
  // Cookie plugin must be registered before authPlugin so cookies are parsed
  // before the auth preHandler reads request.cookies['session'].
  await fastify.register(fastifyCookie);
  // Repos plugin decorates fastify.repos.* — must run before authPlugin.
  await fastify.register(reposPlugin);
  // Auth plugin must be registered before route plugins — decorates request.identity.
  await fastify.register(authPlugin);
  // docsPlugin must be registered before other routes so @fastify/swagger
  // captures all route schemas as they are registered.
  await fastify.register(docsPlugin);
  await fastify.register(loginRoutes);
  await fastify.register(healthRoutes);
  await fastify.register(cardRoutes);
  await fastify.register(providerRoutes);
  await fastify.register(authRoutes);

  return { fastify, config };
}
