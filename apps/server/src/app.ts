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
import { readdir, cp } from 'node:fs/promises';

export type AppResult = { fastify: FastifyInstance; config: Config };

export async function buildApp(): Promise<AppResult> {
  // 0. Load config — fetches secrets from Secrets Manager in production.
  const config = await loadConfig();

  // 1. Ensure EFS subdirectories exist (Lambda only — no-op locally).
  if (process.env['EFS_PATH']) {
    await initEfs(process.env['EFS_PATH']);
    console.log('EFS mtgjson-cache:', await readdir('/mnt/data/mtgjson-cache/parquet'));
  }

  // 2. Initialise PostgreSQL DataSource.
  await initDataSource({
    pgPort: config.pgPort,
    pgPassword: config.pgPassword,
    pgUser: config.pgUser,
    pgDatabase: config.pgDatabase,
    pgHost: config.pgHost,
    ssl: config.pgSsl
  });

  // 3. Initialise repository singletons — must run after DataSource is ready.
  initRepositories(getDataSource());

  // 4. Initialise MTGJSON SDK.
  //    EFS holds the persistent parquet cache (survives cold starts).
  //    DuckDB can't reliably read parquets from NFS (EFS), so on Lambda we:
  //      a) Let the SDK download to EFS (config.mtgjsonCacheDir)
  //      b) Copy the parquets to /tmp (local ephemeral storage)
  //      c) Point the SDK at /tmp for queries
  let sdkCacheDir = config.mtgjsonCacheDir;
  if (process.env['EFS_PATH']) {
    // Ensure parquets exist on EFS (downloads on very first deploy only).
    const efsSdk = await MtgjsonSDK.create({ cacheDir: config.mtgjsonCacheDir });
    // Warm up to trigger lazy parquet downloads (identifiers, legalities).
    await efsSdk.identifiers.getIdentifiers('00000000-0000-0000-0000-000000000000').catch(() => {});
    await efsSdk.legalities.isLegal('00000000-0000-0000-0000-000000000000', 'commander').catch(() => {});
    await efsSdk.close();

    // Copy from EFS to /tmp for DuckDB compatibility.
    sdkCacheDir = '/tmp/mtgjson-cache';
    await cp(config.mtgjsonCacheDir, sdkCacheDir, { recursive: true });
    console.log('Copied parquets to /tmp:', await readdir(sdkCacheDir + '/parquet'));
  }
  const sdk = await MtgjsonSDK.create({ cacheDir: sdkCacheDir });

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
