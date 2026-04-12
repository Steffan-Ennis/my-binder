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
server restarts automatically when source files change. Environment variables are loaded
from `.env.local` via Node's native `--env-file` flag.

```bash
# From the repo root
nvm use
pnpm install

# Copy the template and fill in local values (OAuth client IDs, JWT secret, DB password)
cp apps/server/.env.example apps/server/.env.local

# Start the dev server — reads .env.local automatically
pnpm --filter=@my-binder/server dev
```

The server starts on port `3000` by default. Override with the `PORT` environment variable
in `.env.local`.

### Production build

```bash
# Build the server (compiles TypeScript and copies SQL migrations to dist/)
pnpm --filter=@my-binder/server build

# Start the compiled output — also reads .env.local by default
pnpm --filter=@my-binder/server start
```

> **Note:** The `start` script uses `--env-file=.env.local` for parity with `dev`, which is
> handy for running the compiled build against local Postgres. In deployed environments
> (Lambda, Docker) env vars come from the platform and the `.env.local` file is absent —
> use the appropriate `.env.dev` / `.env.staging` / `.env.prod` file via your deploy tool,
> or override the script at the runtime layer.

## Environment files

The server uses Node's native [`--env-file`](https://nodejs.org/api/cli.html#--env-filepath)
flag to load environment variables. Five files live under `apps/server/`, all gitignored
except the template:

| File | Committed | Purpose |
|---|---|---|
| `.env.example` | ✅ | Template — copy to `.env.local` and fill in. Documents every variable the server reads. |
| `.env.local` | ❌ | Local development. Loaded by `pnpm dev` and `pnpm start`. Real local secrets live here. |
| `.env.dev` | ❌ | AWS dev/sandbox environment. Secrets resolved from Secrets Manager at `my-binder/dev/*`. |
| `.env.staging` | ❌ | AWS staging environment. `NODE_ENV=production`, secrets at `my-binder/staging/*`. |
| `.env.prod` | ❌ | AWS production environment. Secrets at `my-binder/prod/*`. |

Deployed environments (`dev`/`staging`/`prod`) are loaded by the deploy pipeline, not by the
`package.json` scripts directly. At runtime they resolve their DB password and JWT secret via
`DATABASE_SECRET_NAME` and `SESSION_JWT_SECRET_NAME` — see `src/config.ts:resolveSecret`.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the server listens on |
| `NODE_ENV` | No | `development` | `development` \| `test` \| `production` |
| `DB_PATH` | No | `./binder.duckdb` | Path to the DuckDB database file. Use `:memory:` for an in-memory instance |
| `MTGJSON_CACHE_DIR` | No | `./data/mtgjson-cache` | Directory for MTGJSON SDK's parquet cache. Overridden by `EFS_PATH` in Lambda. |
| `CARD_PROVIDER` | No | `mtgjson` | Card data provider identifier |
| `DATABASE_URL` | Yes | `localhost` | Postgres **hostname** (not a connection URL — a legacy name). Writer endpoint for Aurora. |
| `DATABASE_PORT` | No | `5432` | Postgres port |
| `DATABASE_USER` | Yes | `postgres` | Postgres username |
| `DATABASE_PASSWORD` | Yes | — | Postgres password. In AWS, overridden by `DATABASE_SECRET_NAME`. |
| `DATABASE_NAME` | No | `my_binder` | Postgres database name |
| `DATABASE_SECRET_NAME` | No (AWS only) | — | Secrets Manager secret name holding the DB password. When set, overrides `DATABASE_PASSWORD`. |
| `GOOGLE_CLIENT_IDS` | Yes (auth) | — | Comma-separated list of Google OAuth 2.0 client IDs (iOS, Android, Web). Passed as the `audience` parameter to `OAuth2Client.verifyIdToken()` — primary defence against token substitution attacks. |
| `GOOGLE_WEB_CLIENT_ID` | Yes (auth) | — | Web OAuth client ID used by the `/auth/login` browser page (Google Identity Services SDK). Must also appear in `GOOGLE_CLIENT_IDS`. |
| `SESSION_JWT_SECRET` | Yes (auth) | — | Secret for signing/verifying HS256 session JWTs. Min 32 chars. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. In AWS, overridden by `SESSION_JWT_SECRET_NAME`. |
| `SESSION_JWT_SECRET_NAME` | No (AWS only) | — | Secrets Manager secret name holding the JWT secret. |
| `EFS_PATH` | No (Lambda only) | — | When set, `MTGJSON_CACHE_DIR` is derived as `${EFS_PATH}/mtgjson-cache`. |

## Database migrations

Postgres schema is managed by the TypeORM CLI. Migrations live in `src/db/migrations/` and
use the connection config in `src/db/datasource-cli.ts`, which reads from `process.env`
directly (no Secrets Manager). Make sure your env is populated before running any migration
command — either `source` your `.env.local`, use `direnv`, or pass `--env-file` manually.

```bash
# From the repo root — Turbo tasks declared in turbo.json, cache: false

# Generate a new migration from entity diff
turbo migration:generate --filter=@my-binder/server

# Apply pending migrations
turbo migration:run --filter=@my-binder/server

# Roll back the most recent migration
turbo migration:revert --filter=@my-binder/server
```

Or directly from `apps/server/`:

```bash
pnpm migration:generate
pnpm migration:run
pnpm migration:revert
```

Migration tasks depend on `^build` (so `@my-binder/core` is built first for entity imports)
and are marked `cache: false` in `turbo.json` — caching would be unsafe for stateful DB
operations.

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
turbo test --filter=@my-binder/server

# Or from within apps/server
pnpm test
```

## Scripts

```bash
pnpm build               # tsc + tsc-alias → dist/
pnpm dev                 # tsx watch — live reload from source, loads .env.local
pnpm start               # Run compiled dist/index.js, loads .env.local
pnpm test                # jest
pnpm typecheck           # tsc --noEmit

pnpm migration:generate  # Generate a TypeORM migration from entity diff
pnpm migration:run       # Apply pending migrations
pnpm migration:revert    # Revert the most recent migration
```

## Architecture — Production Deployment

### Overview

A single Fastify application runs on Lambda behind API Gateway. It handles both user CRUD and
MTGJSON card queries — there is no sync lambda, no S3 staging bucket, and no second container.
Two persistence layers sit behind the Lambda:

- **Aurora Serverless V2 PostgreSQL** for user-owned state (identities, card collections).
- **EFS** mounted into the Lambda, holding the MTGJSON SDK's parquet cache. The SDK reads
  directly from EFS on each invocation, so there is no round-trip to S3 at request time.

```
                                    ┌──────────────┐
                                    │  Mobile App  │
                                    └──────┬───────┘
                                           ▼
                                 ┌───────────────────┐
                                 │  API Gateway      │
                                 │  (HTTP API)       │
                                 └─────────┬─────────┘
                                           ▼
                                 ┌───────────────────┐
                                 │  Server Lambda    │
                                 │  (Fastify, VPC)   │
                                 └──┬────────────┬───┘
                                    │            │
                           reads/writes     reads parquet
                           user state       via MTGJSON SDK
                                    │            │
                                    ▼            ▼
                         ┌──────────────┐  ┌──────────────────┐
                         │ Aurora V2    │  │ EFS              │
                         │ PostgreSQL   │  │ /mnt/data        │
                         │ (my_binder)  │  │  └─mtgjson-cache │
                         └──────────────┘  └──────────────────┘
                                                  ▲
                                                  │ SDK downloads
                                                  │ fresh parquet
                                                  │ on cache miss
                                            ┌─────┴──────┐
                                            │  MTGJSON   │
                                            │  upstream  │
                                            └────────────┘
```

### Server Lambda (Fastify)

- **Runtime**: `DockerImageFunction` built from `apps/server/Dockerfile`, wrapped with
  `@fastify/aws-lambda` (`src/lambda.ts`).
- **Networking**: private subnets with egress via a `t4g.nano` NAT instance (~$3/month,
  replaces Managed NAT Gateway). Egress is used for MTGJSON parquet downloads and Google
  OAuth token verification.
- **Responsibilities**: auth, card lookup/search/legality, and user collection CRUD. A single
  process owns the full request path — there is no separate analytical service.

### Aurora Serverless V2 PostgreSQL (User State)

- **Purpose**: user identities and card collections. Schema managed by TypeORM migrations in
  `src/db/migrations/`.
- **Accessibility**: writer instance is provisioned in the VPC's **public** subnets with
  `publiclyAccessible: true` so developers can connect with `psql` from a local machine.
  Ingress on 5432 is allowed from the VPC CIDR (Lambda) and from `0.0.0.0/0` (developer
  access — narrow this to a static IP for production).
- **Capacity**: `serverlessV2MinCapacity: 0`, `maxCapacity: 2`, 30-minute auto-pause — the
  cluster scales to zero when idle.
- **Credentials**: provisioned as a Secrets Manager secret (`my-binder-rds-credentials`). The
  Lambda receives `DATABASE_SECRET_NAME` and resolves the password at startup via
  `src/config.ts:resolveSecret`.

### EFS (MTGJSON Parquet Cache)

- **Why EFS, not S3**: the MTGJSON SDK expects a local directory it can read parquet files
  from. Mounting EFS into the Lambda at `/mnt/data` lets the SDK treat a shared, durable
  volume as if it were local disk — the API Lambda has direct parquet access without an
  additional S3 bucket or a separate sync service.
- **Layout**: `/mnt/data/mtgjson-cache/` holds the SDK's parquet cache. Set via the
  `MTGJSON_CACHE_DIR` env var, which `src/config.ts` derives from `EFS_PATH` when that var
  is present.
- **Access point**: EFS access point at `/lambda` with POSIX user `1001:1001`, mounted at
  `/mnt/data` in the Lambda. The access point ACL (`ownerUid/ownerGid` 1001, `0755`)
  ensures the Lambda can create the cache directory on first run.
- **Updates**: the SDK refreshes its own parquet files when they are missing or stale — there
  is no out-of-band sync job.

### Why one Lambda, not two services

An earlier design separated MTGJSON reference data (DuckDB container) from user data (a
relational DB) with a sync Lambda stitching them together via S3 events. That was reverted in
spec 010 once the MTGJSON SDK was capable of serving queries directly from a parquet cache —
the sync Lambda and S3 bucket became unnecessary overhead. The current shape is:

- **One deployable** — one container image, one Lambda, one Fastify app.
- **No event plumbing** — no EventBridge, no cross-service reload API.
- **Cold-start friendly** — the MTGJSON SDK instance is created once per container init and
  reused across invocations; parquet files are already on EFS, so warm invocations have no
  network round-trip to reference data.
