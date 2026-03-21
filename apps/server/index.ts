import Fastify from 'fastify';
import { loadConfig } from './src/config';
import { initDb } from './src/db/client';
import { healthRoutes } from './src/routes/health';
import { cardRoutes } from './src/routes/cards';

async function main(): Promise<void> {
  const config = loadConfig();

  await initDb(config.dbPath);

  const fastify = Fastify({ logger: true });

  await fastify.register(healthRoutes);
  await fastify.register(cardRoutes);

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
