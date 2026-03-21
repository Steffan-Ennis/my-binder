import Fastify from 'fastify';
import { loadConfig } from '@src/config';
import { initDb } from '@src/db/client';
import { healthRoutes } from '@src/routes/health';
import { cardRoutes } from '@src/routes/cards';
import { providerRoutes } from '@src/routes/provider';
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

  await fastify.register(healthRoutes);
  await fastify.register(cardRoutes);
  await fastify.register(providerRoutes);

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
