# Tasks: Server Architecture

**Input**: Design documents from `/specs/001-server-architecture/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story. All paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on concurrent tasks)
- **[Story]**: Maps to spec.md user story (US1 = P1, US2 = P2, US3 = P3)

---

## Phase 1: Setup — Monorepo Root + packages/core

**Purpose**: Establish the pnpm + Turborepo monorepo and build the shared `@my-binder/core`
package that both apps depend on. Nothing in `apps/` can be correctly typed until `packages/core`
is compiled.

**⚠️ CRITICAL**: `packages/core` must be fully built before any `apps/*` workspace can resolve
its imports.

- [X] T001 Overwrite `package.json` at repo root with monorepo config: `private: true`, `engines: {node: ">=22", pnpm: ">=9"}`, Turborepo dev-dependency, scripts delegating to `turbo build/test/typecheck/dev`
- [X] T002 Create `pnpm-workspace.yaml` declaring `packages: ["apps/*", "packages/*"]`
- [X] T003 Create `turbo.json` with tasks: `build` (dependsOn `^build`, outputs `dist/**`), `typecheck` (dependsOn `^build`), `test` (dependsOn `^build`), `dev` (persistent, no cache)
- [X] T004 Create `tsconfig.base.json` with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `strictFunctionTypes: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noImplicitReturns: true`, `esModuleInterop: true`, `skipLibCheck: true`, `declaration: true`, `declarationMap: true`, `sourceMap: true`
- [X] T005 [P] Create `.gitignore` covering: `node_modules/`, `dist/`, `.turbo/`, `*.log`, `.env*`, `.DS_Store`, `*.duckdb`, `*.duckdb.wal`, `coverage/`
- [X] T006 [P] Create `.npmrc` with `shamefully-hoist=false` and `strict-peer-dependencies=false`
- [X] T007 Create `packages/core/package.json`: name `@my-binder/core`, `private: true`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`, exports map, scripts: `build: tsc`, `typecheck: tsc --noEmit`, `dev: tsc --watch`; devDependencies: `typescript ^5.7.0`
- [X] T008 Create `packages/core/tsconfig.json` extending `../../tsconfig.base.json`: `target: ES2022`, `module: CommonJS`, `moduleResolution: Node`, `outDir: ./dist`, `rootDir: ./src`; include `src/**/*`
- [X] T009 [P] Create `packages/core/src/types/index.ts` with TypeScript interfaces: `Card` (id, name, createdAt, updatedAt), `CardList` (cards: Card[], total: number), `CreateCardBody` (name: string), `UpdateCardBody` (name: string), `CardIdParams` (id: string), `HealthResponse` (status: 'ok' \| 'degraded', database: 'connected' \| 'unavailable'), `ErrorBody` (error: string, message: string)
- [X] T010 [P] Create `packages/core/src/schemas/card.ts` exporting all named JSON Schema constants from `data-model.md`: `CARD_RESPONSE_SCHEMA`, `CARD_LIST_RESPONSE_SCHEMA`, `CREATE_CARD_BODY_SCHEMA`, `UPDATE_CARD_BODY_SCHEMA`, `CARD_ID_PARAMS_SCHEMA`, `HEALTH_RESPONSE_SCHEMA`, `ERROR_RESPONSE_SCHEMA` — each typed as `const` with `additionalProperties: false` where specified
- [X] T011 [P] Create `packages/core/src/constants/index.ts` exporting `ERROR_CODES` object (`NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`) and `HTTP_STATUS` object (`OK: 200`, `CREATED: 201`, `NO_CONTENT: 204`, `BAD_REQUEST: 400`, `NOT_FOUND: 404`, `INTERNAL_ERROR: 500`, `SERVICE_UNAVAILABLE: 503`) as `as const`
- [X] T012 Create `packages/core/src/index.ts` barrel-exporting everything from `./types`, `./schemas/card`, `./constants`
- [X] T013 Run `pnpm install` from repo root to install all workspace dependencies and generate `pnpm-lock.yaml`
- [X] T014 Run `pnpm turbo build --filter=@my-binder/core` to compile `packages/core` and verify `packages/core/dist/` is generated with `.js`, `.d.ts`, and `.d.ts.map` files

**Checkpoint**: `packages/core` compiles cleanly; `dist/index.d.ts` exports all types, schemas, and constants. All downstream workspaces can now import from `@my-binder/core`.

---

## Phase 2: Foundational — apps/server Scaffold + DuckDB

**Purpose**: Initialize the `@my-binder/server` workspace, configure TypeScript, wire the DuckDB
connection singleton with retry logic, apply database migrations, and establish config loading.
These are blocking prerequisites for all three user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T015 Create `apps/server/package.json`: name `@my-binder/server`, `private: true`, scripts: `build: tsc`, `dev: tsx watch index.ts`, `start: node dist/index.js`, `test: node --import tsx --test "tests/**/*.test.ts"`, `typecheck: tsc --noEmit`; dependencies: `fastify ^4`, `@duckdb/node-api latest`, `@my-binder/core workspace:*`; devDependencies: `@types/node ^22`, `typescript ^5.7.0`, `tsx ^4`
- [X] T016 Create `apps/server/tsconfig.json` extending `../../tsconfig.base.json`: `target: ES2022`, `module: CommonJS`, `moduleResolution: Node`, `outDir: ./dist`, `rootDir: .`; include `src/**/*` and `index.ts`; exclude `dist`, `node_modules`, `tests`
- [X] T017 [P] Create `apps/server/src/config.ts` exporting `Config` interface (`port: number`, `dbPath: string`, `nodeEnv: 'development' | 'test' | 'production'`) and `loadConfig(): Config` function that reads `PORT` (default `3000`), `DB_PATH` (default `/data/binder.duckdb`), `NODE_ENV` (default `development`) from `process.env`, and overrides `dbPath` to `:memory:` when `nodeEnv === 'test'`
- [X] T018 Create `apps/server/src/db/migrations/001_create_cards.sql` with the exact DDL from `data-model.md`: `CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` and `CREATE TABLE IF NOT EXISTS cards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL CHECK (name != '' AND length(name) <= 255), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
- [X] T019 Create `apps/server/src/db/client.ts` exporting `initDb(dbPath: string): Promise<DuckDBConnection>` and `getDb(): DuckDBConnection`. `initDb` MUST: (1) implement exponential-backoff retry — 5 attempts, delays 500ms/1s/2s/4s/8s — catching file-open errors; (2) on success, run the migration runner that reads all `*.sql` files from `src/db/migrations/` in numeric order, checks `schema_migrations` for already-applied versions, executes unapplied ones in a transaction, and records each in `schema_migrations`; (3) store the connection in module-level state. `getDb()` throws if called before `initDb`.

**Checkpoint**: `apps/server` compiles with `pnpm turbo typecheck --filter=@my-binder/server`. DuckDB client module has no type errors. Config loads from env vars.

---

## Phase 3: User Story 1 — Server Start & Health Check (P1) 🎯 MVP

**Goal**: The server starts with a single command, logs its address, and responds to `GET /health`
confirming liveness and database connectivity.

**Independent Test**: `DB_PATH=:memory: NODE_ENV=development node dist/index.js` starts the
server and `curl http://localhost:3000/health` returns `{"status":"ok","database":"connected"}`
within 100ms.

- [X] T020 [US1] Create `apps/server/src/routes/health.ts` exporting `healthRoutes(fastify: FastifyInstance): Promise<void>`. Register `GET /health` with `schema: { response: { 200: HEALTH_RESPONSE_SCHEMA, 503: HEALTH_RESPONSE_SCHEMA } }` imported from `@my-binder/core`. Handler calls `getDb()`, runs `SELECT 1`, and returns `{ status: 'ok', database: 'connected' }` (200) or `{ status: 'degraded', database: 'unavailable' }` (503) on error. Route must NOT expose connection strings or stack traces.
- [X] T021 [US1] Create `apps/server/index.ts` that: (1) calls `loadConfig()`; (2) calls `await initDb(config.dbPath)` with retry; (3) builds a Fastify instance with `logger: true`; (4) registers `healthRoutes` and a 404 handler returning `ERROR_RESPONSE_SCHEMA`-shaped body; (5) calls `fastify.listen({ port: config.port, host: '0.0.0.0' })` and logs the address; (6) exits with code 1 if `initDb` exhausts all retries
**Checkpoint**: `DB_PATH=:memory: node dist/index.js` starts the server. `curl http://localhost:3000/health` returns 200 with `{"status":"ok","database":"connected"}`. Server logs requests in JSON. Unknown routes return 404 with error body.

---

## Phase 4: User Story 2 — Read Card Collection (P2)

**Goal**: `GET /cards` returns all cards ordered by `createdAt` ascending. `GET /cards/:id`
returns a single card or a 404. Empty collection returns `{"cards":[],"total":0}`.

**Independent Test**: Seed two cards directly via SQL into `:memory:` DB, call `GET /cards`,
confirm both are returned in `createdAt` order with correct `total`. Call `GET /cards/:id`
with a known UUID and confirm the single card response. Call with an unknown UUID and confirm
404 with `NOT_FOUND` error body.

- [X] T024 [US2] Create `apps/server/src/repositories/cardRepository.ts` exporting `CardRepository` class (constructor takes `DuckDBConnection`). Implement `findAll(): Promise<Card[]>` (SELECT all ordered by `created_at ASC`, map snake_case columns → camelCase `Card` type from `@my-binder/core`) and `findById(id: string): Promise<Card | null>` (SELECT by id, return `null` if not found). All queries use parameterised statements. Return types MUST be the `Card` interface from `@my-binder/core` — no ad-hoc objects.
- [X] T025 [US2] Create `apps/server/src/services/cardService.ts` exporting `CardService` class (constructor takes `CardRepository`). Implement `getCards(): Promise<CardList>` (calls `repo.findAll()`, returns `{ cards, total: cards.length }`) and `getCard(id: string): Promise<Card>` (calls `repo.findById(id)`, throws typed `NotFoundError` if null). `NotFoundError` is a local class extending `Error` with an `errorCode: string` property.
- [X] T026 [US2] Create `apps/server/src/routes/cards.ts` exporting `cardRoutes(fastify: FastifyInstance, service: CardService): Promise<void>`. Register `GET /cards` with `schema: { response: { 200: CARD_LIST_RESPONSE_SCHEMA } }` and `GET /cards/:id` with `schema: { params: CARD_ID_PARAMS_SCHEMA, response: { 200: CARD_RESPONSE_SCHEMA, 404: ERROR_RESPONSE_SCHEMA } }`. Catch `NotFoundError` and reply with 404. All schemas imported from `@my-binder/core`.
- [X] T027 [US2] Update `apps/server/index.ts` to instantiate `CardRepository`, `CardService`, and register `cardRoutes(fastify, service)` after `healthRoutes`

**Checkpoint**: `GET /cards` returns `{"cards":[],"total":0}` on an empty DB. `GET /cards/:id` with unknown UUID returns `{"error":"NOT_FOUND","message":"Card with id '...' not found."}` with HTTP 404. No TypeScript errors (`pnpm turbo typecheck`).

---

## Phase 5: User Story 3 — Write Changes to Collection (P3)

**Goal**: `POST /cards` creates a card and returns 201. `PUT /cards/:id` updates name and advances
`updatedAt`. `DELETE /cards/:id` removes the card and returns 204. All writes survive server
restart. Invalid requests are rejected with 400.

**Independent Test**: POST a card, GET it back, PUT a new name, GET again to confirm update, DELETE
it, GET to confirm 404. Restart the server and GET to confirm the card is gone (or present if only
deleted after restart). POST with missing `name` returns 400 with `VALIDATION_ERROR`.

- [X] T028 [US3] Extend `apps/server/src/repositories/cardRepository.ts` with: `create(name: string): Promise<Card>` (INSERT with `gen_random_uuid()`, return the created row), `update(id: string, name: string): Promise<Card | null>` (UPDATE `name` and `updated_at = NOW()` WHERE id, return updated row or null if not found), `delete(id: string): Promise<boolean>` (DELETE WHERE id, return true if a row was deleted). All mutations run inside a DuckDB transaction.
- [X] T029 [US3] Extend `apps/server/src/services/cardService.ts` with: `createCard(name: string): Promise<Card>` (calls `repo.create(name)`), `updateCard(id: string, name: string): Promise<Card>` (calls `repo.update`, throws `NotFoundError` if null), `deleteCard(id: string): Promise<void>` (calls `repo.delete`, throws `NotFoundError` if false)
- [X] T030 [US3] Extend `apps/server/src/routes/cards.ts` with: `POST /cards` (`schema: { body: CREATE_CARD_BODY_SCHEMA, response: { 201: CARD_RESPONSE_SCHEMA, 400: ERROR_RESPONSE_SCHEMA } }`), `PUT /cards/:id` (`schema: { params: CARD_ID_PARAMS_SCHEMA, body: UPDATE_CARD_BODY_SCHEMA, response: { 200: CARD_RESPONSE_SCHEMA, 400: ERROR_RESPONSE_SCHEMA, 404: ERROR_RESPONSE_SCHEMA } }`), `DELETE /cards/:id` (`schema: { params: CARD_ID_PARAMS_SCHEMA, response: { 404: ERROR_RESPONSE_SCHEMA } }`, reply 204 with no body on success). Set `setErrorHandler` to map Fastify/Ajv validation errors to `{ error: 'VALIDATION_ERROR', message: ... }` shape.

**Checkpoint**: Full CRUD works. `POST /cards {}` returns 400 VALIDATION_ERROR. `DELETE /cards/:id` for unknown ID returns 404. `pnpm turbo typecheck` passes with zero errors.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration tests, Docker validation, and quickstart walkthrough.

- [X] T031 [P] Create `apps/server/tests/integration/routes/health.test.ts`: import `node:test` and `node:assert`; build a Fastify instance with in-memory DuckDB; call `GET /health`; assert 200 and `{ status: 'ok', database: 'connected' }`; assert 503 shape when DB unavailable
- [X] T032 [P] Create `apps/server/tests/integration/routes/cards.test.ts`: import `node:test` and `node:assert`; build a Fastify instance with in-memory DuckDB; cover: empty GET /cards returns `{cards:[],total:0}`; POST creates card (201, UUID present); GET by id returns card; GET by unknown id returns 404; PUT updates name and advances updatedAt; DELETE returns 204; second DELETE returns 404; POST with missing name returns 400
- [X] T033 Run `pnpm turbo test --filter=@my-binder/server` and confirm all integration tests pass
- [ ] T034 Run the quickstart.md success criteria manually: (1) health check <100ms; (2) POST returns 201 with UUID; (3) GET /cards ordered by createdAt; (4) GET /cards/:id returns card or 404; (5) PUT updates name + updatedAt; (6) DELETE 204 then 404

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 complete (`packages/core` compiled)
- **Phase 3 (US1)**: Requires Phase 2 complete
- **Phase 4 (US2)**: Requires Phase 2 complete; benefits from Phase 3 (uses `index.ts`)
- **Phase 5 (US3)**: Requires Phase 4 complete (extends repository and service files)
- **Phase 6 (Polish)**: Requires Phases 3–5 complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Phase 2. No dependency on US2 or US3.
- **US2 (P2)**: Can start after Phase 2. Lightly integrates with US1 (extends `index.ts`).
- **US3 (P3)**: Depends on US2 files existing (extends repository, service, and route files).

### Within Each Story

- Repository → Service → Route (each depends on the previous)
- T022 (health route) and T023 (index.ts) can be developed alongside each other once T019 (DB client) is done

---

## Parallel Opportunities

```bash
# Phase 1 — run after T001–T004:
T005 (.gitignore) || T006 (.npmrc) || T009 (types) || T010 (schemas) || T011 (constants)

# Phase 2 — run after T015–T016:
T017 (config.ts) can run alongside T018 (migration SQL)

# Phase 3:
# Phase 6:
T031 (health tests) || T032 (cards tests) — independent test files
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Setup + `packages/core`
2. Complete Phase 2: `apps/server` scaffold + DuckDB client
3. Complete Phase 3: Health route + entry point (T020–T021)
4. **STOP AND VALIDATE**: `node dist/index.js` → `curl /health` returns 200

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Health check server (deployable, container-healthy)
3. Phase 4 → Read-only card API (can demo with seeded data)
4. Phase 5 → Full CRUD API (feature complete)
5. Phase 6 → Tests passing, quickstart validated

---

## Notes

- All file paths are under `apps/server/` or `packages/core/` within the monorepo root
- Schemas imported from `@my-binder/core` — never redefined inline (Principle VII)
- `any` type is prohibited; use `unknown` and narrow (Principle VII, TypeScript strict)
- DuckDB transactions required for all write operations (Principle II)
- `NODE_ENV=test` automatically redirects `dbPath` to `:memory:` (no test container)
- Fastify validation errors are automatically caught by `setErrorHandler` and re-shaped
- `pnpm turbo typecheck` must pass zero errors before any PR merges to `main`
