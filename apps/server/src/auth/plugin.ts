import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import type { AuthState } from '@my-binder/core';
import { verifyToken } from './sessionJwt';
import { getConfig } from '@src/config';

declare module 'fastify' {
  interface FastifyRequest {
    identity: AuthState;
  }
}

/**
 * Auth plugin — decorates every request with `request.identity`.
 *
 * Reads `Authorization: Bearer <token>` header.
 * - Valid JWT → `{ kind: 'authenticated', user: { ... } }` (requires findUserById lookup)
 * - No header or invalid token → `{ kind: 'guest' }` (must NOT throw)
 *
 * Route handlers read `request.identity` to decide whether to return 401.
 */
const authPlugin: FastifyPluginCallback = (fastify: FastifyInstance, _options, done) => {
  const { sessionJwtSecret } = getConfig();

  fastify.decorateRequest('identity', null);

  fastify.addHook('preHandler', async (request) => {
    const authHeader = request.headers['authorization'];

    // Token resolution order: Bearer header → session cookie → guest.
    // Cookies handle browser navigation (GET requests can't set custom headers);
    // Bearer tokens handle API clients and Swagger UI "Try it out" XHR calls.
    let token: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim() || undefined;
    } else {
      token = (request.cookies as Record<string, string> | undefined)?.['session'];
    }

    if (!token) {
      request.identity = { kind: 'guest' };
      return;
    }

    try {
      const userId = verifyToken(token, sessionJwtSecret);
      // Import here to avoid circular dependency issues at module load time.
      const { findUserById } = await import('@src/repositories/userRepository');
      const user = await findUserById(userId);
      if (user === null) {
        request.identity = { kind: 'guest' };
      } else {
        request.identity = { kind: 'authenticated', user };
      }
    } catch {
      // Invalid, expired, or tampered token — fall back to guest. Must NOT throw.
      request.identity = { kind: 'guest' };
    }
  });

  done();
};

export default fp(authPlugin, { name: 'auth-plugin' });
