import 'reflect-metadata';
import { buildApp } from '@src/app';

async function main(): Promise<void> {
  const { fastify, config } = await buildApp();
  console.log(process.env.DATABASE_NAME)
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
