import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { loadConfig } from '@src/config';
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

async function main(): Promise<void> {
  const config = loadConfig();

  await initDb(config.dbPath);

  // Initialise the MTGJSON provider (downloads/loads the DuckDB cache on first run).
  const mtgjsonProvider = await MtgjsonProvider.create({ cacheDir: config.mtgjsonCacheDir });
  registry.register('mtgjson', mtgjsonProvider);
  await registry.setActive(config.cardProvider);

  const fastify = Fastify({ logger: true });

  // Release DuckDB resources when the server shuts down.
  fastify.addHook('onClose', async () => {
    await mtgjsonProvider.close();
  });

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

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
