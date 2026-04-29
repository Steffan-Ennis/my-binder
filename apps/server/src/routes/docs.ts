import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * docsPlugin — registers Swagger UI at /docs, protected by an auth gate.
 *
 * Registration order matters:
 * - `@fastify/swagger` is wrapped in fastify-plugin so its decorators
 *   (fastify.swagger()) leak to the root scope and are available to the
 *   scoped child that hosts @fastify/swagger-ui.
 * - `@fastify/swagger-ui` lives inside a scoped child plugin so its routes
 *   can be gated by a preHandler hook without affecting the root scope.
 *
 * Auth gate uses preHandler (NOT onRequest) — request.identity is set by
 * authPlugin in preHandler; onRequest fires before that and identity is null.
 */
async function docsPluginImpl(fastify: FastifyInstance): Promise<void> {
  // ── @fastify/swagger at root scope ──────────────────────────────────────────
  // Wrapped with fastify-plugin (see export below) so fastify.swagger()
  // decorator is accessible to the scoped child that hosts @fastify/swagger-ui.
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'my-binder API',
        version: '0.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // ── Scoped child plugin: @fastify/swagger-ui + auth gate ─────────────────────
  await fastify.register(async (scoped: FastifyInstance) => {
    // Auth gate MUST be registered before @fastify/swagger-ui so it applies
    // to all /docs/* routes (including static assets served by swagger-ui).
    scoped.addHook('preHandler', async (request, reply) => {
      if (request.identity.kind !== 'authenticated') {
        const acceptsHtml = request.headers['accept']?.includes('text/html');
        if (acceptsHtml) {
          return reply.redirect('/auth/login', 302);
        }
        return reply
          .code(401)
          .send({ code: 'UNAUTHORIZED', message: 'Authentication required to access API documentation.' });
      }
    });

    await scoped.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  });
}

export const docsPlugin = fp(docsPluginImpl, { name: 'docs-plugin' });
