# Research: Swagger Web App with Authentication

**Feature**: 008-swagger-ui-auth
**Date**: 2026-03-27

## Decision Log

### D-001: Swagger Library Choice

**Decision**: Use `@fastify/swagger` + `@fastify/swagger-ui` (official Fastify ecosystem packages).

**Rationale**: These are the only officially-maintained Swagger/OpenAPI plugins for Fastify v4. They integrate directly with Fastify's schema system — routes that already declare `schema.body`, `schema.response`, etc. are automatically included in the generated OpenAPI document without any manual annotation. No other library has the same level of integration.

**Alternatives considered**:
- Hand-authoring an OpenAPI YAML file: rejected because it diverges from the live route definitions immediately, violating FR-008 (auto-sync).
- `swagger-jsdoc`: requires separate JSDoc annotations alongside the code; incompatible with Fastify's native schema approach.

**Versions to use**:
- `@fastify/swagger@^8` — current stable for Fastify v4, outputs OpenAPI 3.0
- `@fastify/swagger-ui@^5` — current stable; serves Swagger UI static assets and connects to the schema endpoint

---

### D-002: Authentication Gate Approach

**Decision**: Register `@fastify/swagger` at root scope (to collect all route schemas) and register `@fastify/swagger-ui` inside a scoped Fastify sub-plugin with a **`preHandler` hook** that enforces `request.identity.kind === 'authenticated'`. A `preHandler` (not `onRequest`) is required because the existing `authPlugin` populates `request.identity` in its own `preHandler` hook — `onRequest` fires before `preHandler` in Fastify's lifecycle, so `request.identity` would be `null` at that point.

**Lifecycle order (Fastify)**: `onRequest` → `preParsing` → `preValidation` → `preHandler`. The root-scope `authPlugin.preHandler` runs first (sets `request.identity`), then the scoped docs `preHandler` runs second (reads `request.identity`). This ordering is guaranteed by Fastify's encapsulation model.

**Unauthenticated response**:
- **Browser requests** (detected by `Accept: text/html` header): HTTP 302 redirect to `/auth/login`.
- **API client requests** (no HTML accept): HTTP 401 with `{ code: "UNAUTHORIZED", message: "..." }` — consistent with existing auth error shapes. This prevents redirect loops on `@fastify/swagger-ui`'s JSON sub-resources.

**Cookie support**: The auth gate checks for a valid `session` cookie in addition to the `Authorization: Bearer` header. The cookie carries the same session JWT; this is required because browser GET navigation cannot attach custom headers.

**Plugin scoping note**: `@fastify/swagger` is wrapped in `fastify-plugin` (breaking encapsulation) so its `fastify.swagger()` decorator is visible at root. `@fastify/swagger-ui` is registered inside the scoped child plugin — it inherits all parent decorators, including `fastify.swagger()`, so it will find the schema correctly.

**Alternatives considered**:
- Using `onRequest` for the auth gate: rejected — `request.identity` is not yet populated at that lifecycle stage; would silently treat all requests as guest.
- Global `preHandler` hook: would fire on every request including health/cards routes, adding unnecessary overhead.
- Serving docs only in `NODE_ENV=development`: rejected because the spec requires authentication as the access control mechanism, not environment gating.

---

### D-003: Bearer Token Authorization in Swagger UI

**Decision**: Configure `@fastify/swagger` with an OpenAPI 3.0 `securitySchemes` entry for `bearerAuth` (HTTP Bearer), and set `security: [{ bearerAuth: [] }]` as the global default. `@fastify/swagger-ui` automatically renders an "Authorize" button when `securitySchemes` is present.

**Rationale**: This is the standard OpenAPI 3.0 pattern for Bearer JWT auth. It requires zero custom UI code — the Swagger UI "Authorize" dialog appears automatically and injects `Authorization: Bearer <token>` into all "Try it out" XHR requests. After signing in via `/auth/login`, the user's session JWT is already in the `session` cookie (used for page-level access to `/docs`). For "Try it out" calls to hit protected endpoints, the user must also paste their JWT into the Authorize dialog — cookies are not forwarded in XHR requests initiated by Swagger UI.

**Note**: The `session` cookie handles browser navigation to `/docs`. The `bearerAuth` dialog handles "Try it out" XHR calls to protected endpoints. These are two separate mechanisms serving two different use cases.

**Alternatives considered**:
- Configuring Swagger UI to auto-read the cookie: not supported by `@fastify/swagger-ui`'s built-in UI without custom HTML injection.
- Custom Swagger UI HTML with auth form: over-engineered; the standard "Authorize" button satisfies the requirement.

---

### D-006: Browser-Based Google Sign-In Login Page

**Decision**: Serve a minimal HTML login page at `GET /auth/login` using the Google Identity Services (GIS) One Tap / button SDK. The page is a static HTML file served directly by Fastify (not behind any auth gate). On successful sign-in, the Google ID token is POSTed to the existing `POST /auth/google` endpoint via `fetch`. The server response sets a `session` cookie and returns `{ token: "..." }`. The login page JS then redirects the browser to `/docs`.

**Rationale**: The existing `POST /auth/google` endpoint already accepts a Google ID token and returns a session JWT — it was designed for mobile clients but works identically for the web. The GIS button SDK handles the entire OAuth flow client-side and returns an ID token without any server-side redirect URI needed. This avoids implementing a full authorization code flow (which would require a server-side `/oauth/callback` endpoint and PKCE).

**Fixed port requirement**: `http://localhost:3000` must be listed as an authorized JavaScript origin in the Google Cloud Console for the web client ID. This is a less strict requirement than a redirect URI (origins allow any path), but the port must still match exactly. `PORT=3000` is therefore a fixed requirement for local development.

**Alternatives considered**:
- Authorization code flow with redirect URI: requires server-side token exchange at `/oauth/callback`, PKCE, state parameter. More complex and introduces a new endpoint. Rejected in favour of the simpler GIS button SDK approach.
- Reusing `/auth/google` with a browser redirect: `POST /auth/google` expects a JSON body, not a form submission — not compatible with plain HTML form redirects.

---

### D-007: Session Cookie for Browser Navigation

**Decision**: When `POST /auth/google` successfully issues a session JWT, the server also sets an `HttpOnly; Secure; SameSite=Strict` cookie named `session` containing the same JWT. The docs auth gate reads the cookie as a fallback when no `Authorization: Bearer` header is present.

**Rationale**: Browser GET navigation (clicking a link, typing a URL, bookmark) cannot attach custom headers. Without a cookie, every browser navigation to `/docs` would be treated as unauthenticated regardless of the user's login state. The cookie carries the same JWT as the Bearer token — no new token format or storage is introduced.

**`@fastify/cookie`**: Required to parse incoming cookies and set `Set-Cookie` response headers. Added to `apps/server/package.json`.

**Security properties**:
- `HttpOnly`: prevents JavaScript access — mitigates XSS token theft.
- `Secure`: only sent over HTTPS (browsers relax this for `localhost`).
- `SameSite=Strict`: prevents CSRF — cookie is not sent on cross-origin navigations.
- Cookie TTL matches JWT TTL (7 days).

**Alternatives considered**:
- `localStorage` for the session JWT: accessible to JS, vulnerable to XSS. Rejected.
- `sessionStorage`: cleared on tab close; poor UX. Rejected.
- Cookie-only (no Bearer token): would require modifying all existing auth-protected routes to also read cookies. Rejected — Bearer token stays as the primary auth mechanism for API clients; cookie is an additional mechanism for browser navigation only.

---

### D-004: Schema File Location

**Decision**: Create `apps/server/src/routes/docs.ts` as the single file responsible for registering both `@fastify/swagger` (schema collection) and the scoped docs UI plugin. Register it in `index.ts` before other route plugins so all routes are captured.

**Rationale**: Keeping both registrations in one file makes it easy to see the complete docs setup at a glance. `@fastify/swagger` must register before routes, so `docsPlugin` must be the first plugin registered in `index.ts`.

**Source layout**:
```
apps/server/src/routes/docs.ts          ← new
apps/server/src/routes/docs.test.ts     ← new (constitution III)
```

---

### D-005: No New Data Model Entities

**Decision**: This feature introduces no new database tables, entities, or persistent state. No `data-model.md` is required beyond noting its absence.

**Rationale**: The docs page is a read-only, in-memory view derived from the server's route registration. Authentication relies entirely on the existing session JWT and `request.identity` infrastructure from spec 007.
