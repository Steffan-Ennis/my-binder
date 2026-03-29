import { loadConfig } from '@src/config';
import { buildApp } from '@src/app';

async function main(): Promise<void> {
  const config = loadConfig();
  const fastify = await buildApp();
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
