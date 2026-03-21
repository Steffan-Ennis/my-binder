# @my-binder/server

Fastify API server for my-binder. Stores and manages a personal card collection in an
embedded DuckDB database. Exposes a JSON REST API consumed by the mobile app.

## API

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns server liveness and database connectivity status |

### Cards

| Method | Path | Description |
|---|---|---|
| `GET` | `/cards` | List all cards ordered by creation date |
| `GET` | `/cards/:id` | Fetch a single card by UUID |
| `POST` | `/cards` | Create a card — body: `{ "name": "string" }` |
| `PUT` | `/cards/:id` | Update a card's name — body: `{ "name": "string" }` |
| `DELETE` | `/cards/:id` | Delete a card |

All request bodies and path params are validated against JSON schemas from `@my-binder/core`
before reaching handler code. All responses conform to a declared schema.

## Project structure

```
apps/server/
├── index.ts                      # Entry point — boots Fastify, connects DB, registers routes
├── src/
│   ├── config.ts                 # Reads PORT, DB_PATH, NODE_ENV from environment
│   ├── db/
│   │   ├── client.ts             # DuckDB singleton connection with retry logic
│   │   └── migrations/
│   │       └── 001_create_cards.sql
│   ├── repositories/
│   │   └── cardRepository.ts     # Raw SQL queries — findAll, findById, create, update, remove
│   ├── services/
│   │   └── cardService.ts        # Business logic — wraps repository, throws typed errors
│   └── routes/
│       ├── health.ts             # GET /health
│       ├── health.test.ts
│       ├── cards.ts              # Card CRUD routes
│       └── cards.test.ts
```

## Starting the server

### Development

Runs the server directly from TypeScript source via `tsx` — no build step required. The
server restarts automatically when source files change.

```bash
# From the repo root
nvm use
pnpm install

# Start with an in-memory database (no file written to disk)
DB_PATH=:memory: pnpm --filter=@my-binder/server dev

# Or start pointing at a local file
DB_PATH=./local.duckdb pnpm --filter=@my-binder/server dev
```

The server starts on port `3000` by default. Override with the `PORT` environment variable.

### Production build

```bash
# Build the server (compiles TypeScript and copies SQL migrations to dist/)
pnpm --filter=@my-binder/server build

# Start the compiled output
DB_PATH=/data/binder.duckdb pnpm --filter=@my-binder/server start
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DB_PATH` | `/data/binder.duckdb` | Path to the DuckDB database file. Use `:memory:` for an in-memory instance |
| `NODE_ENV` | `development` | Set to `test` to force an in-memory database regardless of `DB_PATH` |

## Database

The server uses [DuckDB](https://duckdb.org) as an embedded database — there is no separate
database process. The database is a single file at `DB_PATH`. On startup, the server runs any
pending SQL migrations from `src/db/migrations/` in numeric order and records each applied
version in the `schema_migrations` table.

Connection startup includes exponential-backoff retry (up to 5 attempts: 500ms → 1s → 2s →
4s → 8s) to handle cases where a volume mount is not immediately available.

## Running tests

Tests live next to the source files they cover and use Node's built-in test runner.

```bash
# From the repo root
pnpm turbo test --filter=@my-binder/server

# Or from within apps/server
pnpm test
```

## Scripts

```bash
pnpm build       # tsc + copy migrations to dist/
pnpm dev         # tsx watch — live reload from source
pnpm start       # Run compiled dist/index.js
pnpm test        # node:test across src/**/*.test.ts
pnpm typecheck   # tsc --noEmit
```
