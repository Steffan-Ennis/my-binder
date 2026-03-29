import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { MtgjsonSDK } from 'mtgjson-sdk';
import { loadConfig } from '@src/config';
import { initDb, getDb } from '@src/db/client';
import { importCardDataIfStale } from '@src/db/cardImporter';
import { healthRoutes } from '@src/routes/health';
import { cardRoutes } from '@src/routes/cards';
import { providerRoutes } from '@src/routes/provider';
import { authRoutes } from '@src/routes/auth';
import { loginRoutes } from '@src/routes/login';
import { docsPlugin } from '@src/routes/docs';
import authPlugin from '@src/auth/plugin';
import { MtgjsonProvider } from '@src/providers/mtgjson/index';
import { registry } from '@src/providers/registry';

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();

  // 1. Open DB and run migrations.
  await initDb(config.dbPath);

  // 2. Ensure MTGJSON parquet files are downloaded/cached.
  //    The SDK is only used here for its download logic; card lookups go to DuckDB.
  if (config.nodeEnv !== 'test') {
    const sdk = await MtgjsonSDK.create({ cacheDir: config.mtgjsonCacheDir });
    await sdk.close();

    // 3. Import card data from parquet into DuckDB if parquet is newer than last import.
    const efsPath = process.env['EFS_PATH'];
    await importCardDataIfStale(getDb(), config.mtgjsonCacheDir, efsPath);
  }

  // 4. Register the card provider (queries DuckDB directly).
  const mtgjsonProvider = MtgjsonProvider.create(getDb());
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

  return fastify;
}
