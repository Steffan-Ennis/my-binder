# Research: Server Architecture

**Feature**: 001-server-architecture
**Date**: 2026-03-21
**Status**: Complete — all unknowns resolved (updated 2026-03-21 for Principle VII alignment)

---

## 1. HTTP Framework

**Decision**: `fastify` v4
**Rationale**: Fastify is the minimal-overhead framework that satisfies all three
infrastructure concerns the spec requires without adding speculative features:
- **Routing**: clean, declarative route registration — no hand-rolled URL parser
- **JSON schema validation**: built-in Ajv integration covers FR-008 (reject invalid cards)
  with zero additional dependencies
- **Structured logging**: built-in `pino` logger writes JSON to stdout/stderr, satisfying
  FR-011 (container-friendly logs) without an extra package

**Alternatives considered**:
- Bare `node:http` — no router or schema validator; implementing both from scratch would
  require more code than fastify itself
- Express — older API, no built-in validation, requires separate logging middleware
- Hapi — heavier, more opinionated; violates Principle I for this use case

---

## 2. Database Engine

**Decision**: DuckDB (via `@duckdb/node-api`)
**Rationale**: DuckDB is chosen over PostgreSQL for the following reasons, all validated
by research:

1. **Single SQL technology**: `mtgjson-sdk` already bundles DuckDB internally. Using DuckDB
   for application data means one SQL dialect and one database library across the entire
   stack — no second database engine.

2. **No separate database container**: DuckDB is an embedded, file-based database. The server
   container mounts a `.duckdb` file as a persistent volume. Docker Compose needs only one
   service (the server) — eliminating a database service entirely.

3. **Single-writer limitation is irrelevant**: DuckDB supports one writer at a time per
   process. my-binder is a single Node.js process serving a single user. This is not a
   limitation for this project.

4. **OLTP performance concern is irrelevant**: DuckDB is slower than SQLite for high-volume
   individual record writes. A personal card binder writes tens of records per session, not
   thousands per second. The difference is immaterial.

5. **Full ACID support**: DuckDB supports `BEGIN`/`COMMIT`/`ROLLBACK` with MVCC — writes
   are safe and transactional.

6. **Identical DDL to PostgreSQL**: `gen_random_uuid()`, `TIMESTAMPTZ`, `PRIMARY KEY`,
   `CHECK` constraints — all supported with identical syntax.

7. **Simpler deployment**: A single `.duckdb` file on a mounted volume. No connection
   string, no auth, no database server to manage.

**Alternatives considered**:
- PostgreSQL — adds a second SQL engine alongside DuckDB (already present via mtgjson-sdk),
  requires a separate container and connection management; over-engineered for a single-user
  personal app
- SQLite — also embedded and file-based, but a third SQL engine when DuckDB is already
  present; SQLite lacks DuckDB's analytical query capabilities needed for card search
- Bare `node:http` — unrelated; HTTP framework decision above

**Node.js package**: `@duckdb/node-api` (the new official async API — the older `duckdb`
package is deprecated as of late 2025)

---

## 3. Migrations

**Decision**: Plain SQL files applied at startup via a minimal in-process runner
**Rationale**: A `migrations/` directory with numbered `.sql` files applied in order at
server startup. The server tracks applied migrations in a `schema_migrations` table within
the same DuckDB file. No external migration CLI or dependency required — Principle I.

**Alternatives considered**:
- External migration library — adds a CLI dependency; over-engineered for one table

---

## 4. Startup Database Retry

**Decision**: Exponential backoff, 5 attempts (500ms → 1s → 2s → 4s → 8s)
**Rationale**: DuckDB opens a local file — a "retry" here handles the case where the
mounted volume is not yet ready (e.g., slow storage attachment in Docker). 5 attempts
covers this without blocking indefinitely. Total wait ≈15.5s, within SC-007 (30s).

Note: Unlike PostgreSQL, DuckDB has no network connection to establish — the "retry" is
a file-open retry, not a TCP connection retry. In practice, the first attempt will almost
always succeed.

---

## 5. Configuration

**Decision**: All config loaded from environment variables in `config.js` at startup.

**Variables**:
- `PORT` — TCP port to listen on (default: `3000`)
- `DB_PATH` — Path to the `.duckdb` file (default: `/data/binder.duckdb`)
- `NODE_ENV` — `development` | `test` | `production`

`config.js` validates all required variables at startup and exits with a clear error if
any are missing. `DB_PATH` is the only database config needed — no URL, no credentials,
no host. Simpler than PostgreSQL's `DATABASE_URL`.

---

## 6. Testing Approach

**Decision**: `node:test` (built-in) with a real DuckDB in-memory database for tests
**Rationale**: DuckDB supports `:memory:` mode — integration tests open an in-memory
database, apply migrations, run tests, and discard everything. No test container needed.
This makes tests faster and simpler than PostgreSQL's test container approach.

Unit tests cover model schema and service-layer logic independently of the database.

---

## 7. Strong Typing & Schema Validation (Principle VII)

**Decision**: JSDoc `@ts-check` for static type safety + Fastify's Ajv integration for
runtime validation at both the inbound and outbound boundaries of every route.

**Rationale**: The server is JavaScript (Node 22) — a transpilation step would contradict
Principle I and the Technology Stack constraint. The pragmatic strong-typing approach for
plain JS is:

1. **`// @ts-check` in every source file** — VS Code and `tsc --noEmit` perform full type
   checking against JSDoc annotations with zero build overhead. No `.ts` files, no `tsc`
   compilation target. A `jsconfig.json` or `"checkJs": true` in `tsconfig.json` (with
   `"noEmit": true`) enables this.

2. **JSDoc annotations on every function** — every exported function MUST declare `@param`
   and `@returns` types. The `@duckdb/node-api` and `fastify` packages both ship TypeScript
   declaration files (`.d.ts`), so their types are available for JSDoc use without installing
   `@types/*` packages.

3. **`/** @type {import('fastify').FastifyInstance} */` and similar** — inline JSDoc type
   imports give precise types to all framework objects.

4. **Fastify inbound schemas**: every route MUST declare `schema.body` (for POST/PUT),
   `schema.params` (for `:id` routes), and `schema.querystring` (if used). Fastify compiles
   these to Ajv validators and runs them before the handler — non-conforming requests are
   automatically rejected with 400 before any application code runs.

5. **Fastify outbound schemas**: every route MUST also declare `schema.response`. Fastify
   uses these for fast JSON serialisation AND as a second validation gate — fields not in
   the response schema are stripped, preventing accidental data leakage.

6. **No raw `JSON.parse` at boundaries** — any JSON parsed from an external source (DuckDB
   JSON columns, provider responses in later specs) MUST be validated through a schema before
   use. In this feature, DuckDB returns typed rows, not raw JSON, so this is covered by the
   repository's JSDoc return types.

**Alternatives considered**:
- Full TypeScript compilation — adds a build step (transpiler), contradicting Principle I
  and the Technology Stack constraint; rejected
- Runtime-only validation without JSDoc — leaves type errors to tests rather than catching
  them at development time; rejected (weaker than Principle VII requires)
- Zod / Joi schema libraries — add a dependency and duplicate what Fastify/Ajv already
  provides built-in; rejected (Principle I)

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| HTTP framework | `fastify` v4 |
| Database engine | DuckDB (embedded, file-based) |
| Database package | `@duckdb/node-api` |
| Migration approach | Plain SQL files, in-process runner |
| DB file location | Mounted volume at `DB_PATH` env var |
| Test database | In-memory DuckDB (`:memory:`) — no test container |
| DB retry strategy | File-open retry, exponential backoff, 5 attempts |
| Config mechanism | `config.js` reads env vars at startup |
| Test runner | `node:test` built-in |
| Static type safety | JSDoc `@ts-check` + `tsc --noEmit` (no build step) |
| Runtime inbound validation | Fastify `schema.body` / `schema.params` (Ajv, built-in) |
| Runtime outbound validation | Fastify `schema.response` (serialisation + stripping) |
