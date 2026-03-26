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

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the server listens on |
| `DB_PATH` | No | `./binder.duckdb` | Path to the DuckDB database file. Use `:memory:` for an in-memory instance |
| `NODE_ENV` | No | `development` | Set to `test` to force an in-memory database regardless of `DB_PATH` |
| `GOOGLE_CLIENT_IDS` | Yes (auth) | — | Comma-separated list of Google OAuth 2.0 client IDs. Include the iOS, Android, and Web client IDs registered in your Google Cloud project. Example: `123.apps.googleusercontent.com,456.apps.googleusercontent.com`. Passed as the `audience` parameter to `OAuth2Client.verifyIdToken()` — primary defence against token substitution attacks. |
| `SESSION_JWT_SECRET` | Yes (auth) | — | Secret for signing and verifying server-issued session JWTs. Must be at least 32 characters. Generate with `openssl rand -base64 32`. Never commit to source control — supply via environment or secrets manager. |

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

## Architecture — Production Deployment

### Overview

The production architecture separates concerns into two data layers: a **DuckDB container** for
MTGJSON reference data (read-only, analytical) and a **User DB** for collections, decklists, and
user state (CRUD, low-latency). S3 acts as the durable staging area and event source that keeps
both in sync.

```
┌─────────────┐
│  MTGJSON     │  (periodic releases)
│  upstream    │
└──────┬──────┘
       ▼
┌─────────────┐     S3 Event      ┌──────────────────┐
│  S3 Bucket  │ ─────────────────▶│  Sync Lambda     │
│  (raw data) │                   └──┬───────────┬───┘
└──────┬──────┘                      │           │
       │                      API call to    sync card
       │                      reload from    metadata
       │                      S3 source         │
       │                             │           │
       │                             ▼           ▼
       │                      ┌───────────┐  ┌───────────┐
       └◀─────────────────────│  DuckDB   │  │  User DB  │
         (reads S3 on reload) │ Container │  │ (Dynamo/  │
                              │ (MTGJSON) │  │  Postgres)│
                              └─────┬─────┘  └─────┬─────┘
                                    │              │
                                    └──────┬───────┘
                                           ▼
                                    ┌─────────────┐
                                    │   API Layer  │
                                    └──────┬──────┘
                                           ▼
                                    ┌─────────────┐
                                    │  Mobile App  │
                                    └─────────────┘
```

### DuckDB Container (MTGJSON Reference Data)

- **Runtime**: ECS Fargate or Cloud Run — always-on container with DuckDB loaded in memory
- **Latency**: ~5-20ms per query (data already in memory, no S3 round-trip)
- **Purpose**: Full MTGJSON dataset — advanced card search, filtering by stats, set lookups, price data
- **Updates**: Infrequent (new MTG sets release every few months). Sync Lambda calls a reload API
  endpoint on the container, which then fetches the latest dataset directly from S3
- **Exposes**: REST API for card lookups (consumed by the API layer) and a reload endpoint
  (consumed by the Sync Lambda)

### User DB (Collections & Decklists)

- **Options**: DynamoDB (serverless, ~5-10ms), Supabase/RDS Postgres (relational, ~5-20ms)
- **Purpose**: User-owned data — collections, decklists, quantities, preferences
- **Auth**: User entities anchored to a Cognito user pool (or equivalent auth service)
- **Schema**:
  - `users` — linked to Cognito identity
  - `collections` — user_id + card_id (references MTGJSON) + quantity
  - `decklists` — user_id + deck_name + list of card_id references

### S3 as Staging & Event Source

S3 is **not queried at runtime**. It serves as:

- **Durable storage** — raw MTGJSON files (JSON/Parquet) live here permanently
- **Event source** — S3 put events trigger the sync Lambda via EventBridge
- **Decoupling layer** — separates data ingestion from query serving

```
S3 upload (new MTGJSON data)
  → S3 Event / EventBridge
    → Sync Lambda:
        1. Calls DuckDB container API to reload from S3 source
        2. Syncs denormalized card metadata into User DB
```

### Denormalization Strategy

Key card fields (name, set, image URL, mana cost, type) are synced from MTGJSON into the User DB
alongside collection/decklist records. This means:

- **Decklist and collection views render without cross-DB joins** — the User DB has enough card
  info to display a list
- **DuckDB is only needed for deep queries** — advanced search, filtering across the full card
  pool, analytics
- **Snappy UX for the common case** — viewing your collection and decks hits only the User DB

### Why Not DuckDB for Everything?

DuckDB is embedded and single-writer. Running it serverlessly (S3 + Lambda) introduces
200-500ms cold start latency from S3 file fetches, which is too slow for user-facing CRUD.
Separating reference data (DuckDB) from user data (persistent DB) gives the best of both:
fast analytical queries on MTGJSON and low-latency reads/writes for user collections.
