import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { MtgjsonSDK } from 'mtgjson-sdk';
import { loadConfig, type Config } from '@src/config';
import { initDb } from '@src/db/client';
import { healthRoutes } from '@src/routes/health';
import { cardRoutes } from '@src/routes/cards';
import { providerRoutes } from '@src/routes/provider';
import { authRoutes } from '@src/routes/auth';
import { loginRoutes } from '@src/routes/login';
import { docsPlugin } from '@src/routes/docs';
import authPlugin from '@src/auth/plugin';
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

  // 2. Open DB and run migrations.
  await initDb(config.dbPath);

  // 3. Initialise MTGJSON SDK — downloads parquet files on first cold start,
  //    reads from EFS cache on subsequent starts.
  const sdk = await MtgjsonSDK.create({ cacheDir: config.mtgjsonCacheDir });

  // 4. Register the card provider backed by the SDK.
  const mtgjsonProvider = new MtgjsonProvider(sdk);
  registry.register('mtgjson', mtgjsonProvider);
  await registry.setActive(config.cardProvider);

  // 5. Build the Fastify instance.
  const fastify = Fastify({ logger: true });

  // Cookie plugin must be registered before authPlugin so cookies are parsed
  // before the auth preHandler reads request.cookies['session'].
  await fastify.register(fastifyCookie);
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
