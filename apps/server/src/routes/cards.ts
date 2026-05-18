import { FastifyInstance } from 'fastify';
import {
  CARD_RESPONSE_SCHEMA,
  CARD_LIST_RESPONSE_SCHEMA,
  CREATE_CARD_BODY_SCHEMA,
  UPDATE_CARD_BODY_SCHEMA,
  CARD_ID_PARAMS_SCHEMA,
  CARD_IMAGES_RESPONSE_SCHEMA,
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
  checkCommanderLegality,
  searchCards,
  getCardImagesById,
  NotFoundError,
  CardNotFoundError,
  ProviderUnavailableError,
} from '@src/services/cardService';

type LegalityQuerystring = { name: string; commander_colors?: string };
type SearchQuerystring = {
  name?: string; set?: string; colors?: string;
  cmc_min?: number; cmc_max?: number; page?: number; limit?: number;
  // Spec 018 / FR-005 — comma-separated catalogue filter dimensions.
  formats?: string; super_types?: string; sub_types?: string; creature_types?: string;
  missing_only?: boolean;
};

// Parse a comma-separated list, trimming each token and dropping empty tokens.
const parseList = (raw: string | undefined): string[] | undefined => {
  if (raw === undefined) return undefined;
  const tokens = raw.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  return tokens.length > 0 ? tokens : undefined;
};

export async function cardRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error, _request, reply) => {
    console.error(error)

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

  // Registered before `/cards/:id` so Fastify matches the literal `images`
  // segment first instead of capturing it as the `:id` param of the CRUD route.
  fastify.get<{ Params: CardIdParams }>('/cards/images/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: CARD_ID_PARAMS_SCHEMA,
      response: {
        200: CARD_IMAGES_RESPONSE_SCHEMA,
        404: ERROR_RESPONSE_SCHEMA,
        503: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const images = await getCardImagesById(request.params.id);
    return reply.code(HTTP_STATUS.OK).send(images);
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
        401: ERROR_RESPONSE_SCHEMA,
        503: ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    const {
      name, set, colors, cmc_min, cmc_max, page, limit,
      formats, super_types, sub_types, creature_types, missing_only,
    } = request.query;

    const parsedFormats = parseList(formats);
    const parsedSuperTypes = parseList(super_types);
    const parsedSubTypes = parseList(sub_types);
    const parsedCreatureTypes = parseList(creature_types);

    // Spec 018 / FR-005 — `missing_only=true` requires an authenticated request
    // because evaluating "the user does not own this printing" is meaningless
    // without a user identity.
    if (missing_only === true && request.identity.kind !== 'authenticated') {
      return reply.code(HTTP_STATUS.UNAUTHORIZED).send({
        error: ERROR_CODES.AUTH_INVALID_TOKEN,
        message: 'Authentication required for the missing_only filter.',
      });
    }

    const hasAnyNewFilter =
      parsedFormats !== undefined ||
      parsedSuperTypes !== undefined ||
      parsedSubTypes !== undefined ||
      parsedCreatureTypes !== undefined ||
      missing_only === true;

    // At least one filter must be provided. The new spec-018 dimensions count
    // toward this — an authenticated `missing_only=true` browse is a valid
    // full-catalogue request that should NOT short-circuit.
    if (
      !name && !set && !colors &&
      cmc_min === undefined && cmc_max === undefined &&
      !hasAnyNewFilter
    ) {
      return reply.code(HTTP_STATUS.BAD_REQUEST).send({
        error: ERROR_CODES.MISSING_FILTER,
        message: 'At least one search filter must be provided.',
      });
    }

    const userId = request.identity.kind === 'authenticated'
      ? request.identity.user.id
      : undefined;

    const result = await searchCards({
      name,
      set,
      colorIdentity: colors ? colors.split(',').map((c) => c.trim().toUpperCase()) : undefined,
      cmcMin: cmc_min,
      cmcMax: cmc_max,
      page,
      limit,
      ...(parsedFormats !== undefined && { formats: parsedFormats }),
      ...(parsedSuperTypes !== undefined && { superTypes: parsedSuperTypes }),
      ...(parsedSubTypes !== undefined && { subTypes: parsedSubTypes }),
      ...(parsedCreatureTypes !== undefined && { creatureTypes: parsedCreatureTypes }),
      ...(missing_only !== undefined && { missingOnly: missing_only }),
      ...(userId !== undefined && { userId }),
    });
    return reply.code(HTTP_STATUS.OK).send(result);
  });
}
