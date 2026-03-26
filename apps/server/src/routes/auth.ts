import type { FastifyInstance } from 'fastify';
import {
  GOOGLE_SIGN_IN_BODY_SCHEMA,
  GOOGLE_SIGN_IN_RESPONSE_SCHEMA,
  AUTH_ME_RESPONSE_SCHEMA,
  AUTH_ERROR_RESPONSE_SCHEMA,
  AUTH_ERROR_CODES,
} from '@my-binder/core';
import type { GoogleSignInBody, GoogleSignInResponse } from '@my-binder/core';
import { signIn as defaultSignIn, InvalidGoogleTokenError } from '@src/services/authService';

type AuthRoutesOpts = {
  signIn?: (idToken: string) => Promise<GoogleSignInResponse>;
};

export async function authRoutes(
  fastify: FastifyInstance,
  opts: AuthRoutesOpts = {},
): Promise<void> {
  const signIn = opts.signIn ?? defaultSignIn;

  // ─── POST /auth/google ──────────────────────────────────────────────────────

  fastify.post<{ Body: GoogleSignInBody }>('/auth/google', {
    schema: {
      body: GOOGLE_SIGN_IN_BODY_SCHEMA,
      response: {
        200: GOOGLE_SIGN_IN_RESPONSE_SCHEMA,
        400: AUTH_ERROR_RESPONSE_SCHEMA,
        401: AUTH_ERROR_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    try {
      const result = await signIn(request.body.idToken);
      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof InvalidGoogleTokenError) {
        return reply.code(401).send({
          code: AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN,
          message: 'Google ID token verification failed.',
        });
      }
      throw err;
    }
  });

  // ─── GET /auth/me ───────────────────────────────────────────────────────────

  fastify.get('/auth/me', {
    schema: {
      response: {
        200: AUTH_ME_RESPONSE_SCHEMA,
      },
    },
  }, async (request, reply) => {
    return reply.code(200).send(request.identity);
  });

  // ─── POST /auth/signout ─────────────────────────────────────────────────────

  fastify.post('/auth/signout', {
    schema: {
      response: {
        204: { type: 'null' },
      },
    },
  }, async (_request, reply) => {
    // No server-side revocation: 7-day TTL is the sole safeguard.
    // The mobile client is responsible for deleting the stored token.
    // See contracts/auth.json for trade-off documentation.
    return reply.code(204).send();
  });
}
