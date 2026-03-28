# Implementation Plan: Swagger Web App with Authentication

**Branch**: `008-swagger-ui-auth` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-swagger-ui-auth/spec.md`

## Summary

Add `@fastify/swagger` + `@fastify/swagger-ui` to `apps/server`, protected by the existing session JWT auth system. The docs page at `/docs` is accessible only to authenticated users. Authentication is checked via a **`preHandler` hook** (not `onRequest`) so that `request.identity` — populated by the existing `authPlugin.preHandler` — is available when the gate runs.

A browser-based Google Sign-In page is served at `GET /auth/login` (outside the docs auth gate). After successful sign-in, the server issues a session JWT via the existing `POST /auth/google` handler, sets it as an `HttpOnly` `session` cookie, and redirects the browser to `/docs`. The docs auth gate accepts either a `session` cookie or an `Authorization: Bearer` header — cookies handle browser navigation; Bearer tokens handle "Try it out" XHR calls in Swagger UI.

The server port is fixed at `3000`. This is a hard requirement for Google Cloud Console to accept `http://localhost:3000` as an authorized JavaScript origin for the web OAuth client.

The OpenAPI 3.0 schema is auto-generated from Fastify's native route schema declarations — no manual annotation required. The Swagger UI "Authorize" dialog is pre-configured for `bearerAuth` so developers can also call protected endpoints via "Try it out".

## Technical Context

**Language/Version**: TypeScript 5 / Node 22
**Primary Dependencies**: Fastify v4, `@fastify/swagger@^8`, `@fastify/swagger-ui@^5`, `@fastify/cookie@^9`, `fastify-plugin@^4` (existing)
**Storage**: N/A — no new database tables or persistent state
**Testing**: Node built-in `node:test` runner (same as existing server tests)
**Target Platform**: Node 22 Docker container (`apps/server`)
**Project Type**: Web service (API server + docs UI endpoint + browser login page)
**Performance Goals**: Docs page load < 2s on loopback; schema generation is synchronous on first request
**Constraints**: Port fixed at 3000; docs auth gate must use `preHandler` (not `onRequest`); must keep docs in sync with live routes automatically
**Scale/Scope**: Internal developer tool; single-user or small-team access expected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Two packages, one new file (`docs.ts`), minimal config. No abstractions beyond what's needed. |
| II. Data Integrity | PASS | No new data entities. No writes. Read-only schema endpoint. |
| III. Test-First Development | PASS | `docs.test.ts` required alongside `docs.ts` per co-location rule. |
| IV. Single Responsibility | PASS | `docs.ts` has one purpose: serve authenticated API documentation. Auth enforcement is delegated to the existing `request.identity` decoration. |
| V. Transparency & Legibility | PASS | Plugin registration is explicit in `index.ts`; auth hook is co-located in `docs.ts`. |
| VI. Layered Architecture | PASS | Docs endpoint lives in `apps/server`. No cross-layer shortcuts introduced. |
| VII. Strong Typing | PASS | `@fastify/swagger` and `@fastify/swagger-ui` ship TypeScript types. New code uses strict TypeScript; no `any`. |

**Post-design re-check**: All gates still pass. The scoped plugin pattern for auth does not introduce cross-cutting coupling.

## Project Structure

### Documentation (this feature)

```text
specs/008-swagger-ui-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── docs.json        # /docs endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
apps/server/
├── index.ts                             # UPDATED — register cookiePlugin + docsPlugin before routes
├── package.json                         # UPDATED — add @fastify/swagger, @fastify/swagger-ui, @fastify/cookie
├── .env.example                         # NEW — all required env vars including GOOGLE_WEB_CLIENT_ID, PORT=3000
├── src/
│   ├── config.ts                        # UPDATED — add googleWebClientId field; include in googleClientIds audience
│   ├── auth/
│   │   └── plugin.ts                    # UPDATED — also read session cookie as fallback auth source
│   └── routes/
│       ├── docs.ts                      # NEW — swagger registration + preHandler auth gate
│       ├── docs.test.ts                 # NEW — unit + integration tests
│       ├── login.ts                     # NEW — serves /auth/login HTML page + handles cookie set on sign-in
│       └── login.test.ts                # NEW — unit + integration tests
└── docs/
    └── api-docs.md                      # NEW — documents the /docs feature (constitution §Task Verification)
```

**Structure Decision**: Single server workspace; no new workspace or layer. `login.ts` lives alongside existing auth routes. `index.ts` gains two `register` calls (cookie plugin + docs plugin). Package deps added to `apps/server/package.json` only.

## Implementation Notes

### Plugin Registration Order

`docsPlugin` must be registered in `index.ts` **before** other route plugins. `@fastify/swagger` hooks into Fastify's `addRoute` lifecycle; if registered after routes, those routes will not appear in the schema.

```
index.ts register order:
  1. authPlugin          ← existing — decorates request.identity in preHandler (must be first)
  2. cookiePlugin        ← new — @fastify/cookie; must be before authPlugin reads cookies
  3. docsPlugin          ← new — registers @fastify/swagger (root scope) + scoped UI with preHandler auth gate
  4. loginRoutes         ← new — serves GET /auth/login (unauthenticated, before authRoutes)
  5. healthRoutes        ← existing
  6. cardRoutes          ← existing
  7. providerRoutes      ← existing
  8. authRoutes          ← existing
```

**Note on `cookiePlugin` order**: `@fastify/cookie` must be registered before `authPlugin` because `authPlugin` needs to read the `session` cookie in its `preHandler` hook. `@fastify/cookie` is registered via `fastify-plugin` (it breaks encapsulation by default), so it decorates the root instance.

### Auth Gate Design

`@fastify/swagger` is registered at root scope (no auth requirement — it just collects schemas), wrapped in `fastify-plugin` so its `fastify.swagger()` decorator leaks to the root and is accessible by the scoped UI child.

`@fastify/swagger-ui` is registered inside a scoped Fastify plugin with a **`preHandler` hook** (not `onRequest`):

```typescript
// Pseudocode — not implementation
fastify.register(async (scoped) => {
  // preHandler runs AFTER root authPlugin.preHandler sets request.identity
  scoped.addHook('preHandler', async (request, reply) => {
    if (request.identity.kind !== 'authenticated') {
      const acceptsHtml = request.headers['accept']?.includes('text/html');
      if (acceptsHtml) {
        reply.redirect(302, '/auth/login');
      } else {
        reply.code(401).send({ code: 'UNAUTHORIZED', message: '...' });
      }
    }
  });
  await scoped.register(swaggerUi, { routePrefix: '/docs', ... });
});
```

**Why `preHandler` not `onRequest`**: The existing `authPlugin` sets `request.identity` in its `preHandler`. Fastify's lifecycle is `onRequest → preParsing → preValidation → preHandler`. If the docs gate ran in `onRequest`, `request.identity` would still be `null` — every request would appear unauthenticated regardless of credentials.

**Cookie auth in `authPlugin`**: The existing `authPlugin.preHandler` is updated to check for a `session` cookie as a fallback when no `Authorization: Bearer` header is present:

```typescript
// Pseudocode — not implementation
const token =
  authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim()
  : request.cookies?.['session'] ?? '';
```

This covers `/docs/*` static asset routes, not just `/docs` itself, and all routes served by `@fastify/swagger-ui`.

### OpenAPI Configuration

- `openapi.info.title`: `"my-binder API"`
- `openapi.info.version`: derived from `package.json` version (or hardcoded `"0.0.0"` as placeholder)
- `openapi.components.securitySchemes.bearerAuth`: `{ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }`
- `openapi.security`: `[{ bearerAuth: [] }]` (global default — applies to all endpoints in the explorer)

### Login Page Design (`GET /auth/login`)

A minimal self-contained HTML page served by Fastify at `GET /auth/login`. Not behind any auth gate. Contains:

1. A Google Identity Services `<script>` tag loading the GIS SDK.
2. A `<div id="g_id_onload">` element with `data-client_id="${GOOGLE_WEB_CLIENT_ID}"` and `data-callback="handleCredentialResponse"`.
3. A `<div class="g_id_signin">` button element.
4. A JS `handleCredentialResponse(response)` callback that:
   - POSTs `{ idToken: response.credential }` to `POST /auth/google`.
   - On success: redirects the browser to `/docs`.
   - On failure: displays an inline error message.

**`POST /auth/google` cookie update**: When the endpoint successfully issues a session JWT, it additionally calls `reply.setCookie('session', token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 7 * 24 * 60 * 60 })` (same TTL as the JWT).

**`GOOGLE_WEB_CLIENT_ID`**: The web client ID is injected into the login HTML at serve time from `config.googleWebClientId`. This is a string field added to the `Config` type in `src/config.ts`.

### Error Response Consistency

The 401 response from the docs auth gate uses the same shape as existing auth errors:
```json
{ "code": "UNAUTHORIZED", "message": "Authentication required to access API documentation." }
```
This keeps the error surface consistent across the API. Browser requests receive a redirect instead of a 401 body.

## Complexity Tracking

> No constitution violations — table not required.
