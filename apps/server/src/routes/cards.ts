import { FastifyInstance } from 'fastify';
import {
  CARD_RESPONSE_SCHEMA,
  CARD_LIST_RESPONSE_SCHEMA,
  CREATE_CARD_BODY_SCHEMA,
  UPDATE_CARD_BODY_SCHEMA,
  CARD_ID_PARAMS_SCHEMA,
  LOOKUP_QUERYSTRING_SCHEMA,
  LOOKUP_RESPONSE_SCHEMA,
  LEGALITY_QUERYSTRING_SCHEMA,
  LEGALITY_RESPONSE_SCHEMA,
  SEARCH_QUERYSTRING_SCHEMA,
  SEARCH_RESULT_SCHEMA,
  ERROR_RESPONSE_SCHEMA,
  HTTP_STATUS,
  ERROR_CODES,
} from '@my-binder/core';
import type { CreateCardBody, UpdateCardBody, CardIdParams } from '@my-binder/core';
import {
  getCards,
  getCard,
  createCard,
  updateCard,
  deleteCard,
  lookupCard,
  checkCommanderLegality,
  searchCards,
  NotFoundError,
  CardNotFoundError,
  ProviderUnavailableError,
} from '@src/services/cardService';

type LookupQuerystring = { name: string; fuzzy?: boolean; set?: string; number?: string };
type LegalityQuerystring = { name: string; commander_colors?: string };
type SearchQuerystring = {
  name?: string; set?: string; colors?: string;
  cmc_min?: number; cmc_max?: number; page?: number; limit?: number;
};

export async function cardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: ERROR_CODES.VALIDATION_ERROR,
        message: error.message,
      });
    }
    if (error instanceof ProviderUnavailableError) {
      return reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send({
        error: ERROR_CODES.PROVIDER_UNAVAILABLE,
        message: error.message,
      });
    }
    if (error instanceof CardNotFoundError) {
      return reply.code(HTTP_STATUS.NOT_FOUND).send({
        error: ERROR_CODES.CARD_NOT_FOUND,
        message: error.message,
      });
    }
    if (error instanceof NotFoundError) {
      return reply.code(HTTP_STATUS.NOT_FOUND).send({
        error: ERROR_CODES.NOT_FOUND,
        message: error.message,
      });
    }
    fastify.log.error(error);
    return reply.code(HTTP_STATUS.INTERNAL_ERROR).send({
      error: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    });
  });

  fastify.get('/cards', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: CARD_LIST_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { id: userId } = (request.identity as { kind: 'authenticated'; user: { id: string } }).user;
    const list = await getCards(userId);
    return reply.code(200).send(list);
  });

  fastify.get<{ Params: CardIdParams }>('/cards/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: CARD_ID_PARAMS_SCHEMA,
      response: {
        200: CARD_RESPONSE_SCHEMA,
        404: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { id: userId } = (request.identity as { kind: 'authenticated'; user: { id: string } }).user;
    const card = await getCard(request.params.id, userId);
    return reply.code(200).send(card);
  });

  fastify.post<{ Body: CreateCardBody }>('/cards', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CREATE_CARD_BODY_SCHEMA,
      response: {
        201: CARD_RESPONSE_SCHEMA,
        400: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { id: userId } = (request.identity as { kind: 'authenticated'; user: { id: string } }).user;
    const card = await createCard(request.body, userId);
    return reply.code(201).send(card);
  });

  fastify.put<{ Params: CardIdParams; Body: UpdateCardBody }>('/cards/:id', {
    preHandler: [fastify.authenticate],
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
    const { id: userId } = (request.identity as { kind: 'authenticated'; user: { id: string } }).user;
    const card = await updateCard(request.params.id, request.body, userId);
    return reply.code(200).send(card);
  });

  fastify.delete<{ Params: CardIdParams }>('/cards/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: CARD_ID_PARAMS_SCHEMA,
      response: {
        204: { type: 'null' },
        404: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { id: userId } = (request.identity as { kind: 'authenticated'; user: { id: string } }).user;
    await deleteCard(request.params.id, userId);
    return reply.code(204).send();
  });

  // ─── Provider-backed card endpoints (spec 004) ─────────────────────────────

  fastify.get<{ Querystring: LookupQuerystring }>('/cards/lookup', {
    schema: {
      querystring: LOOKUP_QUERYSTRING_SCHEMA,
      response: {
        200: LOOKUP_RESPONSE_SCHEMA,
        400: ERROR_RESPONSE_SCHEMA,
        503: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { name, fuzzy = true, set, number } = request.query;
    const result = await lookupCard(name, { fuzzy, set, number });
    if (!Array.isArray(result)) {
      return reply.code(HTTP_STATUS.OK).send(result);
    }
    return reply.code(HTTP_STATUS.OK).send({ found: true, cards: result });
  });

  fastify.get<{ Querystring: LegalityQuerystring }>('/cards/legality', {
    schema: {
      querystring: LEGALITY_QUERYSTRING_SCHEMA,
      response: {
        200: LEGALITY_RESPONSE_SCHEMA,
        404: ERROR_RESPONSE_SCHEMA,
        503: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { name, commander_colors } = request.query;
    const commanderColors = commander_colors
      ? commander_colors.split(',').map((c) => c.trim().toUpperCase())
      : undefined;
    const result = await checkCommanderLegality(name, commanderColors);
    return reply.code(HTTP_STATUS.OK).send(result);
  });

  fastify.get<{ Querystring: SearchQuerystring }>('/cards/search', {
    schema: {
      querystring: SEARCH_QUERYSTRING_SCHEMA,
      response: {
        200: SEARCH_RESULT_SCHEMA,
        400: ERROR_RESPONSE_SCHEMA,
        503: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const { name, set, colors, cmc_min, cmc_max, page, limit } = request.query;

    // At least one filter must be provided.
    if (!name && !set && !colors && cmc_min === undefined && cmc_max === undefined) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: ERROR_CODES.MISSING_FILTER,
        message: 'At least one search filter must be provided.',
      });
    }

    const result = await searchCards({
      name,
      set,
      colorIdentity: colors ? colors.split(',').map((c) => c.trim().toUpperCase()) : undefined,
      cmcMin: cmc_min,
      cmcMax: cmc_max,
      page,
      limit,
    });
    return reply.code(HTTP_STATUS.OK).send(result);
  });
}
