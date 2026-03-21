import type { FastifyInstance } from 'fastify';
import {
  PROVIDER_INFO_SCHEMA,
  SWITCH_PROVIDER_BODY_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  HTTP_STATUS,
  ERROR_CODES,
} from '@my-binder/core';
import {
  registry,
  ProviderRegistryNotFoundError,
  ProviderRegistryUnreachableError,
} from '@src/providers/registry';

type SwitchProviderBody = { name: string };

export async function providerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/provider', {
    schema: {
      response: {
        200: PROVIDER_INFO_SCHEMA,
      },
    },
  }, async (_request, reply) => {
    const info = await registry.getProviderInfo();
    return reply.code(HTTP_STATUS.OK).send(info);
  });

  fastify.put<{ Body: SwitchProviderBody }>('/provider', {
    schema: {
      body: SWITCH_PROVIDER_BODY_SCHEMA,
      response: {
        200: PROVIDER_INFO_SCHEMA,
        400: ERROR_RESPONSE_SCHEMA,
        404: ERROR_RESPONSE_SCHEMA,
        422: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    try {
      await registry.setActive(request.body.name);
      const info = await registry.getProviderInfo();
      return reply.code(HTTP_STATUS.OK).send(info);
    } catch (err) {
      if (err instanceof ProviderRegistryNotFoundError) {
        return reply.code(HTTP_STATUS.NOT_FOUND).send({
          error: ERROR_CODES.PROVIDER_NOT_FOUND,
          message: err.message,
        });
      }
      if (err instanceof ProviderRegistryUnreachableError) {
        return reply.code(HTTP_STATUS.UNPROCESSABLE).send({
          error: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: err.message,
        });
      }
      fastify.log.error(err);
      return reply.code(HTTP_STATUS.INTERNAL_ERROR).send({
        error: ERROR_CODES.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      });
    }
  });
}
