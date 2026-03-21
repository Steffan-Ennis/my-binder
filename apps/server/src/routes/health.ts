import { FastifyInstance } from 'fastify';
import { HEALTH_RESPONSE_SCHEMA } from '@my-binder/core';
import { getDb } from '@src/db/client';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', {
    schema: {
      response: {
        200: HEALTH_RESPONSE_SCHEMA,
        503: HEALTH_RESPONSE_SCHEMA,
      },
    },
  }, async (_request, reply) => {
    try {
      getDb();
      return reply.code(200).send({ status: 'ok', database: 'connected' });
    } catch {
      return reply.code(503).send({ status: 'degraded', database: 'unavailable' });
    }
  });
}
