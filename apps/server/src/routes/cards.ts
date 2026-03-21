import { FastifyInstance } from 'fastify';
import {
  CARD_RESPONSE_SCHEMA,
  CARD_LIST_RESPONSE_SCHEMA,
  CREATE_CARD_BODY_SCHEMA,
  UPDATE_CARD_BODY_SCHEMA,
  CARD_ID_PARAMS_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  HTTP_STATUS,
} from '@my-binder/core';
import type { CreateCardBody, UpdateCardBody, CardIdParams } from '@my-binder/core';
import {
  getCards,
  getCard,
  createCard,
  updateCard,
  deleteCard,
  NotFoundError,
} from '@src/services/cardService';

export async function cardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
    if (error instanceof NotFoundError) {
      return reply.code(HTTP_STATUS.NOT_FOUND).send({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    fastify.log.error(error);
    return reply.code(HTTP_STATUS.INTERNAL_ERROR).send({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  fastify.get('/cards', {
    schema: {
      response: {
        200: CARD_LIST_RESPONSE_SCHEMA,
      },
    },
  }, async (_request, reply) => {
    const list = await getCards();
    return reply.code(200).send(list);
  });

  fastify.get<{ Params: CardIdParams }>('/cards/:id', {
    schema: {
      params: CARD_ID_PARAMS_SCHEMA,
      response: {
        200: CARD_RESPONSE_SCHEMA,
        404: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const card = await getCard(request.params.id);
    return reply.code(200).send(card);
  });

  fastify.post<{ Body: CreateCardBody }>('/cards', {
    schema: {
      body: CREATE_CARD_BODY_SCHEMA,
      response: {
        201: CARD_RESPONSE_SCHEMA,
        400: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const card = await createCard(request.body);
    return reply.code(201).send(card);
  });

  fastify.put<{ Params: CardIdParams; Body: UpdateCardBody }>('/cards/:id', {
    schema: {
      params: CARD_ID_PARAMS_SCHEMA,
      body: UPDATE_CARD_BODY_SCHEMA,
      response: {
        200: CARD_RESPONSE_SCHEMA,
        400: ERROR_RESPONSE_SCHEMA,
        404: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const card = await updateCard(request.params.id, request.body);
    return reply.code(200).send(card);
  });

  fastify.delete<{ Params: CardIdParams }>('/cards/:id', {
    schema: {
      params: CARD_ID_PARAMS_SCHEMA,
      response: {
        204: { type: 'null' },
        404: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    await deleteCard(request.params.id);
    return reply.code(204).send();
  });
}
