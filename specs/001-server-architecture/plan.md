# Implementation Plan: Server Architecture

**Branch**: `001-server-architecture` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-server-architecture/spec.md`

## Summary

Build the foundational API server for my-binder: a containerised Node 22 HTTP service using
DuckDB as its embedded database. The server exposes a structured-data REST API for card
collection CRUD operations, handles startup with file-open retry logic, and emits
container-friendly logs. DuckDB is chosen over PostgreSQL because `mtgjson-sdk` already
bundles it — keeping one SQL technology across the entire stack and eliminating a separate
database container. The server is the single integration point for all client and provider
communication per Principle VI (Layered Architecture). All request and response shapes are
validated against declared JSON schemas at the route level per Principle VII (Strong Typing
& Schema Validation).

## Technical Context

**Language/Version**: TypeScript 5 (Node 22); compiled with `tsc`; `strict: true`
**Workspace**: `apps/server` within the my-binder pnpm monorepo
**Primary Dependencies**:
- `fastify` — minimal HTTP framework with built-in JSON schema validation (Ajv) for inbound
  request validation AND outbound response serialisation; structured pino logging
- `@duckdb/node-api` — official modern DuckDB Node.js driver (Promise-based async API)
- `@my-binder/core` — shared TypeScript types, schemas, and constants from `packages/core`
**Storage**: DuckDB — embedded, file-based database; persisted via Docker volume mount
**Testing**: Node 22 built-in `node:test`; DuckDB `:memory:` mode for integration tests
  (no test container needed)
**Target Platform**: Linux container (Docker); single-container deployment (no DB service)
**Project Type**: web-service / REST API
**Performance Goals**: startup <3s, health-check <100ms, CRUD ops <500ms for 10,000 cards
**Constraints**: all config via env vars; JSON-only responses; single owner; no auth in this
  feature (auth is spec 002)
**Scale/Scope**: single-user personal application; card collection up to ~10,000 cards

**DATABASE_TYPE resolved**: DuckDB replaces `TODO(DATABASE_TYPE)` in the constitution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ PASS | DuckDB eliminates the database container. `fastify` justified (see Complexity Tracking). `node:test` avoids an extra dependency. In-memory test DB avoids a test container. TypeScript is the project-wide standard per constitution — not an added complexity. |
| II. Data Integrity | ✅ PASS | All writes use DuckDB transactions. Input validated against JSON schema on entry. File-open retry prevents starting in a degraded state. |
| III. Test-First Development | ✅ PASS | Tests written before routes. Integration tests use DuckDB `:memory:` — real queries, no mocks, no container. Schema validation tests written before route handlers. |
| IV. Single Responsibility | ✅ PASS | Routes → Services → Repositories → DB. Config loading isolated to `config.js`. JSON schemas isolated to `models/card.js`. |
| V. Transparency & Legibility | ✅ PASS | Fastify structured logs to stdout/stderr. Named constants for status codes and error messages. `DB_PATH` and `PORT` named clearly in config. JSDoc annotations document every function signature. |
| VI. Layered Architecture | ✅ PASS | This IS the API server layer. No provider calls in this feature (spec 004). DuckDB is the only downstream dependency. Mobile app is never aware of the database. |
| VII. Strong Typing & Schema Validation | ✅ PASS | TypeScript `strict: true` enforces no-implicit-any and null safety at compile time. Fastify Ajv validates ALL inbound request bodies and path parameters at runtime before handlers run. Fastify response schemas enforce ALL outbound shapes at serialisation time. No unvalidated data passes a boundary. |

*Post-design re-check: project structure preserves all layer boundaries and all validation
boundaries. No violations.*

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `fastify` dependency | REST routing + JSON schema validation + structured logging + response schema serialisation | Bare `node:http` has none of these — hand-rolling all four would be more complex than one focused package |

## Project Structure

### Documentation (this feature)

```text
specs/001-server-architecture/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── health.md
│   ├── cards-read.md
│   └── cards-write.md
└── tasks.md             # /speckit.tasks output — NOT created here
```

### Source Code (repository root)

```text
my-binder/                          # Repo root
├── apps/
│   └── server/                     # This workspace
│       ├── src/
│       │   ├── config.ts           # Env var loading + validation (PORT, DB_PATH, NODE_ENV)
│       │   ├── db/
│       │   │   ├── client.ts       # DuckDB connection singleton (DuckDBInstance.fromCache);
│       │   │   │                   # file-open retry logic; migration runner
│       │   │   └── migrations/
│       │   │       └── 001_create_cards.sql
│       │   ├── repositories/
│       │   │   └── cardRepository.ts  # SQL: findAll, findById, create, update, delete
│       │   ├── services/
│       │   │   └── cardService.ts     # Business logic: error mapping, not-found detection
│       │   └── routes/
│       │       ├── health.ts          # GET /health
│       │       └── cards.ts           # GET/POST/PUT/DELETE /cards and /cards/:id
│       ├── tests/
│       │   ├── unit/
│       │   │   └── services/cardService.test.ts
│       │   └── integration/
│       │       └── routes/
│       │           ├── health.test.ts
│       │           └── cards.test.ts  # Uses DuckDB :memory:
│       ├── Dockerfile
│       ├── docker-compose.yml         # Single service: server only
│       ├── tsconfig.json              # strict: true, target: ES2022, moduleResolution: NodeNext
│       ├── index.ts                   # Entry point
│       └── package.json              # name: "@my-binder/server"
├── packages/
│   └── core/                         # Shared across all workspaces
│       ├── src/
│       │   ├── schemas/
│       │   │   └── card.ts           # CARD_RESPONSE_SCHEMA, CREATE_CARD_BODY_SCHEMA, etc.
│       │   │                         # (the named JSON Schema constants from data-model.md)
│       │   ├── types/
│       │   │   └── index.ts          # Card, CardList, HealthResponse, ErrorResponse interfaces
│       │   └── constants/
│       │       └── index.ts          # ERROR_CODES, STATUS_VALUES (as const enums / objects)
│       ├── tsconfig.json             # strict: true; declaration: true; declarationMap: true
│       └── package.json              # name: "@my-binder/core"; exports: ./dist
├── turbo.json                        # Pipeline: build, test, dev, typecheck
├── pnpm-workspace.yaml               # packages: ["apps/*", "packages/*"]
└── package.json                      # Root: engines {node, pnpm}; no dependencies
```

**Structure Decision**: pnpm monorepo with Turborepo. `apps/server` is the only deployable
in this feature. `packages/core` holds the named JSON Schema constants from `data-model.md`
so they can be imported by `apps/server` and later by `apps/mobile` (Principle VII — schema
definitions must not be duplicated across workspaces).

**Schema ownership** (Principle VII): All JSON Schema constants defined in `data-model.md`
live in `packages/core/src/schemas/card.ts`. TypeScript interfaces for all HTTP shapes live
in `packages/core/src/types/index.ts`. `apps/server` route files import from
`@my-binder/core` — no inline anonymous schemas or locally-redefined types permitted.

**Turborepo pipeline** (`turbo.json`):
- `build`: depends on `^build` (core built before server)
- `test`: depends on `^build`
- `typecheck`: depends on `^build`; runs `tsc --noEmit` per workspace
- `dev`: persistent, no cache

**Docker Compose note**: The `.duckdb` file is stored at the path set by `DB_PATH`
(default: `/data/binder.duckdb`) and mounted from a host volume so data survives container
recreation. No database service, no database credentials, no network between containers
for data access.
