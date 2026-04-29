# Tasks: Swagger Web App with Authentication

**Input**: Design documents from `/specs/008-swagger-ui-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/docs.json ✅, quickstart.md ✅

**Tests**: Included — constitution §III (Test-First Development) requires test files co-located with implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Tests MUST be written and FAIL before the corresponding implementation tasks

---

## Phase 1: Setup

**Purpose**: Install new dependencies — prerequisite for all implementation work

- [x] T001 Add `@fastify/swagger@^8`, `@fastify/swagger-ui@^4` (v5 requires Fastify v5; project uses v4), and `@fastify/cookie@^9` to `apps/server/package.json` and run `pnpm install`

---

## Phase 2: Config & Infrastructure

**Purpose**: Add `GOOGLE_WEB_CLIENT_ID` to server config and cookie support to auth plugin — prerequisites for login page and docs gate.

**⚠️ CRITICAL**: T001 must be complete before any implementation work begins.

- [x] T002 Update `apps/server/src/config.ts` — add `googleWebClientId: string` field; include it in the `googleClientIds` audience array (append to the existing comma-split list so the server accepts tokens from the web client)
- [x] T003 Register `@fastify/cookie` in `apps/server/index.ts` **before** `authPlugin` — it must parse cookies before the auth preHandler reads them
- [x] T004 Update `apps/server/src/auth/plugin.ts` — extend the `preHandler` hook to also check `request.cookies['session']` as a fallback when no `Authorization: Bearer` header is present; token resolution order: Bearer header → session cookie → guest
- [x] T005 Create `apps/server/.env.example` with all required env vars (see Phase 7)

**Checkpoint**: Cookie parsing and web client ID config are in place. Auth plugin now accepts both Bearer and cookie credentials.

---

## Phase 3: Login Page — User Story 4 (Priority: P2)

**Goal**: A browser user opens `/auth/login`, clicks "Sign in with Google", and is redirected to `/docs` with a `session` cookie set.

**Independent Test**: Open `http://localhost:3000/auth/login` in a browser → "Sign in with Google" renders → complete sign-in → redirected to `/docs` with `session` cookie set.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US4] Write failing integration test: `GET /auth/login` returns 200 with HTML body containing `google.accounts` script tag in `apps/server/src/routes/login.test.ts`
- [x] T007 [P] [US4] Write failing integration test: `GET /auth/login` returns 200 with `Content-Type: text/html` in `apps/server/src/routes/login.test.ts`

### Implementation for User Story 4

- [x] T008 [US4] Create `apps/server/src/routes/login.ts` — Fastify route plugin that serves `GET /auth/login` with a self-contained HTML page embedding the Google Identity Services SDK, `data-client_id` from `config.googleWebClientId`, and a `handleCredentialResponse` JS callback that POSTs to `POST /auth/google` and redirects to `/docs` on success
- [x] T009 [US4] Update `POST /auth/google` in `apps/server/src/routes/auth.ts` — after successfully issuing the session JWT, call `reply.setCookie('session', token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 7 * 24 * 60 * 60 })` before sending the response
- [x] T010 [US4] Register `loginRoutes` in `apps/server/index.ts` — register after `authPlugin` and before `authRoutes` (it must not be inside any auth-gated scope)

**Checkpoint**: Browser sign-in flow works. Session cookie is set after Google sign-in. `/auth/login` is publicly accessible.

---

## Phase 4: User Story 1 — Authenticated Access to API Docs (Priority: P1) 🎯 MVP

**Goal**: A logged-in user (with a valid session cookie or Bearer token) navigates to `/docs` and sees a fully rendered, interactive Swagger UI listing all API endpoints.

**Independent Test**: Sign in via `/auth/login`, then navigate to `http://localhost:3000/docs` — Swagger UI renders with all routes visible.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Write failing integration test: authenticated `GET /docs` returns 200 or 302 (redirect to index) in `apps/server/src/routes/docs.test.ts`
- [x] T012 [P] [US1] Write failing integration test: authenticated `GET /docs/json` returns 200 with OpenAPI object containing `info.title === "my-binder API"` in `apps/server/src/routes/docs.test.ts`

### Implementation for User Story 1

- [x] T013 [US1] Create `apps/server/src/routes/docs.ts` — register `@fastify/swagger` at root scope (via `fastify-plugin` wrapping) with `openapi: { openapi: '3.0.0', info: { title: 'my-binder API', version: '...' } }`
- [x] T014 [US1] Add scoped sub-plugin in `docs.ts` — register `@fastify/swagger-ui` with `routePrefix: '/docs'` inside `fastify.register(async (scoped) => { ... })` (auth gate added in Phase 5)
- [x] T015 [US1] Update `apps/server/index.ts` to register `docsPlugin` immediately after `cookiePlugin`/`authPlugin` and before `healthRoutes`, `cardRoutes`, `providerRoutes`, and `authRoutes`

**Checkpoint**: Authenticated users can load `/docs` and `/docs/json`. Unauthenticated access is not yet blocked (Phase 5).

---

## Phase 5: User Story 2 — Unauthenticated Gate (Priority: P2)

**Goal**: Browser requests to `/docs` without a session cookie are redirected to `/auth/login`; API client requests without a Bearer token receive HTTP 401.

**Independent Test**:
- Browser (no cookie): navigate to `http://localhost:3000/docs` → redirected to `/auth/login`.
- API client: `curl -i http://localhost:3000/docs/json` → `HTTP/1.1 401`, body `{"code":"UNAUTHORIZED","message":"Authentication required to access API documentation."}`.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [US2] Write failing integration tests in `docs.test.ts`:
  - Unauthenticated `GET /docs/json` (no header, no cookie) → 401 with `{ code: 'UNAUTHORIZED' }`
  - Unauthenticated `GET /docs` with `Accept: text/html` → 302 redirect to `/auth/login`
  - Unauthenticated `GET /docs/yaml` → 401

### Implementation for User Story 2

- [x] T017 [US2] Add **`preHandler`** hook (not `onRequest`) to the scoped docs plugin in `docs.ts`:
  - If `request.identity.kind !== 'authenticated'`:
    - If `request.headers.accept` includes `text/html`: `reply.redirect(302, '/auth/login')`
    - Otherwise: `reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Authentication required to access API documentation.' })`
  - Hook MUST be registered **before** `swaggerUi` registration inside the scoped block

**Checkpoint**: Unauthenticated browser navigation redirects to `/auth/login`. Unauthenticated API calls receive 401. Authenticated access (cookie or Bearer) works.

---

## Phase 6: User Story 3 — API Explorer with Auth Token (Priority: P3)

**Goal**: The Swagger UI "Authorize" button is pre-wired for `bearerAuth`. A developer pastes their session JWT and "Try it out" requests to protected endpoints succeed.

**Independent Test**: `GET /docs/json` (authenticated) → response body contains `components.securitySchemes.bearerAuth` with `{ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }` and top-level `security: [{ bearerAuth: [] }]`.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T018 [US3] Write failing integration test: authenticated `GET /docs/json` response body contains `components.securitySchemes.bearerAuth` and `security[0].bearerAuth` in `docs.test.ts`

### Implementation for User Story 3

- [x] T019 [US3] Extend the `@fastify/swagger` config in `docs.ts` — add `openapi.components.securitySchemes.bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }` and `openapi.security: [{ bearerAuth: [] }]`

**Checkpoint**: All four user stories are independently functional and testable. Swagger UI renders the Authorize button. "Try it out" works for protected endpoints.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, `.env.example`, and final validation

- [x] T020 Create `apps/server/.env.example` with all required env vars:
  ```
  # Server
  PORT=3000
  # NOTE: Port must be fixed at 3000 — changing it breaks Google OAuth (authorized JavaScript origin)
  NODE_ENV=development

  # Database
  DB_PATH=./binder.duckdb
  MTGJSON_CACHE_DIR=./data/mtgjson-cache
  CARD_PROVIDER=mtgjson

  # Auth — Google OAuth
  # Comma-separated list of authorized Google OAuth client IDs (iOS, Android, Web)
  # Web client ID must be included here AND in GOOGLE_WEB_CLIENT_ID
  GOOGLE_CLIENT_IDS=your-ios-client-id.apps.googleusercontent.com,your-android-client-id.apps.googleusercontent.com,your-web-client-id.apps.googleusercontent.com

  # Web-specific client ID used by the /auth/login browser login page (Google Identity Services SDK)
  # Must be registered in Google Cloud Console with http://localhost:3000 as an authorized JavaScript origin
  GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

  # Session JWT — min 32 characters, high entropy
  SESSION_JWT_SECRET=replace-with-a-long-random-secret-min-32-chars
  ```
- [x] T021 Create `apps/server/docs/api-docs.md` documenting the `/docs` feature: how to sign in via `/auth/login`, how to use the Authorize dialog, the cookie mechanism, and the 401/redirect response shapes (constitution §Task Verification)
- [ ] T022 Run all quickstart.md scenarios (Scenarios 1–5) against the live server to validate SC-001 through SC-005

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Config & Infrastructure (Phase 2)**: Depends on T001
- **Login Page (Phase 3)**: Depends on T001, T002, T003 (cookie plugin), T004 (cookie auth in plugin)
- **User Stories (Phases 4–6)**: All depend on T001–T004
  - US1 (Phase 4) → US2 (Phase 5) → US3 (Phase 6): sequential; each phase extends Phase 4 code
  - US4 (Phase 3) is independent of US1–US3 but must precede US2 (redirect target must exist)
- **Polish (Phase 7)**: Depends on all user stories complete

### Within Each User Story

- Tests MUST be written and fail before implementation tasks
- `docs.ts` tasks are sequential within their phase
- `login.ts` tasks (T008–T010) are sequential within Phase 3

### Parallel Opportunities

- T006 + T007 (login.test.ts failing tests) can run in parallel with T008 (login.ts skeleton)
- T011 + T012 (docs.test.ts failing tests) can run in parallel with T013 (docs.ts skeleton)
- T020 (`.env.example`) can be written any time after T002

---

## Notes

- [P] tasks = different files, no incomplete-task dependencies
- `@fastify/swagger` MUST be registered at root scope — it hooks into route registration lifecycle
- `@fastify/swagger-ui` MUST be inside the scoped plugin so the auth hook applies to all `/docs/*` routes
- `docsPlugin` MUST wrap `@fastify/swagger` with `fastify-plugin` so its decorators (including `fastify.swagger()`) leak to the root scope
- The docs auth hook MUST use **`preHandler`** (not `onRequest`) — `request.identity` is set by `authPlugin` in `preHandler`; `onRequest` runs before that
- The `preHandler` auth hook MUST be registered BEFORE `swaggerUi` inside the scoped block
- `loginRoutes` MUST NOT be inside any auth-gated scope
- Commit after each phase checkpoint to keep history clean
