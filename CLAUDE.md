# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**my-binder** is a personal card binder application (JavaScript, Node 22).

## Monorepo Structure

This is a **pnpm + Turborepo monorepo**. Workspaces:

| Path | Package | Purpose |
|------|---------|---------|
| `apps/server` | `@my-binder/server` | Fastify API server (spec 001) |
| `apps/mobile` | `@my-binder/mobile` | Mobile app — iOS + Android (spec 002) |
| `packages/core` | `@my-binder/core` | Shared schemas, types, constants |
| `packages/infrastructure` | `@my-binder/infrastructure` | AWS CDK v2 infrastructure (spec 009) |

## Folder Structure

```
my-binder/
├── apps/
│   └── server/                         # @my-binder/server — Fastify API
│       ├── src/
│       │   ├── app.ts                  # Fastify app builder (SDK init, plugin registration)
│       │   ├── config.ts               # Config loader (env vars + Secrets Manager)
│       │   ├── lambda.ts               # @fastify/aws-lambda entry point
│       │   ├── auth/
│       │   │   ├── googleVerifier.ts   # Google ID token verification
│       │   │   ├── plugin.ts           # Fastify auth plugin (decorates request.identity)
│       │   │   └── sessionJwt.ts       # HS256 session JWT issue/verify
│       │   ├── db/
│       │   │   ├── client.ts           # DuckDB singleton + migration runner
│       │   │   └── migrations/
│       │   │       ├── 001_create_cards.sql
│       │   │       └── 002_create_users.sql
│       │   ├── providers/
│       │   │   ├── interface.ts        # CardProvider type + LookupOptions
│       │   │   ├── registry.ts         # Provider registry (register/setActive/getActive)
│       │   │   └── mtgjson/
│       │   │       ├── index.ts        # MtgjsonProvider — SDK-backed CardProvider impl
│       │   │       └── mapper.ts       # mapCardSetToCardRecord (CardSet → CardRecord)
│       │   ├── repositories/
│       │   │   ├── cardRepository.ts   # User collection CRUD (binder.duckdb)
│       │   │   └── userRepository.ts   # User upsert/lookup (binder.duckdb)
│       │   ├── routes/
│       │   │   ├── auth.ts             # POST /auth/google, GET /auth/me, POST /auth/signout
│       │   │   ├── cards.ts            # GET|POST /cards, /cards/lookup, /cards/legality, /cards/search
│       │   │   ├── docs.ts             # GET /docs (Swagger UI, auth-gated)
│       │   │   ├── health.ts           # GET /health
│       │   │   ├── login.ts            # GET /auth/login (Google sign-in page)
│       │   │   └── provider.ts         # GET|PUT /provider
│       │   └── services/
│       │       ├── authService.ts      # Sign-in orchestration (verify → upsert → JWT)
│       │       └── cardService.ts      # Card lookup/search/legality with pagination
│       ├── docs/                       # Server-specific docs
│       ├── index.ts                    # Local dev entry point
│       ├── .env.example                # Env var template (committed)
│       ├── .env.local                  # Local dev env (gitignored) — loaded by `pnpm dev`/`start`
│       ├── .env.dev                    # AWS dev/sandbox env (gitignored)
│       ├── .env.staging                # AWS staging env (gitignored)
│       ├── .env.prod                   # AWS production env (gitignored)
│       └── Dockerfile
├── packages/
│   ├── core/                           # @my-binder/core — shared types + schemas
│   │   └── src/
│   │       ├── constants/              # Shared constants
│   │       ├── schemas/                # Ajv/JSON schemas (card, auth)
│   │       └── types/                  # TypeScript types (CardRecord, SearchQuery, etc.)
│   └── infrastructure/                 # @my-binder/infrastructure — AWS CDK v2
│       ├── bin/app.ts                  # CDK app entry point
│       └── lib/my-binder-stack.ts      # Lambda + API Gateway + EFS + ECR stack
├── specs/                              # Feature specifications (speckit workflow)
│   ├── 001-server-architecture/
│   ├── 004-card-data-provider/
│   ├── 007-google-oauth-auth/
│   ├── 008-swagger-ui-auth/
│   ├── 009-infrastructure/
│   └── 010-revert-mtgjson-infra/
├── todo/                               # Informal TODO notes
├── CLAUDE.md
├── turbo.json
├── tsconfig.base.json
└── pnpm-lock.yaml
```

## Setup

```bash
nvm use              # Switch to Node 22 (see .nvmrc)
pnpm install         # Install all workspace dependencies
```

## Scripts

```bash
turbo test      # Run tests across all workspaces
turbo build     # Build all workspaces (core first)
turbo typecheck # Run tsc --noEmit across all workspaces
turbo dev       # Start all dev servers

# Server-only: TypeORM migrations (Postgres). See apps/server/README.md.
# Declared in turbo.json with cache: false (stateful DB operations).
turbo migration:generate --filter=@my-binder/server
turbo migration:run      --filter=@my-binder/server
turbo migration:revert   --filter=@my-binder/server
```

### Environment files (`apps/server/`)

The server uses Node's `--env-file` flag to load env vars. `pnpm dev` and `pnpm start` both
read `apps/server/.env.local`. Five files exist, only `.env.example` is committed:

| File | Purpose |
|---|---|
| `.env.example` | Template (committed) — documents every var the server reads |
| `.env.local` | Local development — loaded by `pnpm dev` / `pnpm start` |
| `.env.dev` | AWS dev/sandbox — secrets resolved via `*_SECRET_NAME` from Secrets Manager |
| `.env.staging` | AWS staging — `NODE_ENV=production`, Secrets Manager |
| `.env.prod` | AWS production — Secrets Manager |

Required Postgres vars: `DATABASE_URL` (hostname, despite the name), `DATABASE_PORT`,
`DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`. In AWS, `DATABASE_SECRET_NAME` and
`SESSION_JWT_SECRET_NAME` override the inline secrets — see `apps/server/src/config.ts:resolveSecret`.

## Notes

- Use `pnpm` — not `npm` or `yarn`. `pnpm-lock.yaml` is the canonical lock file.
- Workspaces are built separately and deployed independently.
- `packages/core` must be built before `apps/*` (Turborepo handles this automatically).
- Each `apps/*` workspace has its own `Dockerfile` and deploy pipeline.

## Active Technologies
- **TypeScript 5** (`strict: true`) — project-wide language for all workspaces
- **Node 22** — server runtime (`apps/server`)
- **Fastify v4** — HTTP framework with Ajv JSON schema validation (`apps/server`)
- **`@duckdb/node-api`** — DuckDB Node.js driver (`apps/server`); app DB only (`binder.duckdb` — user collection)
- **`mtgjson-sdk@0.1.1`** — MTGJSON card data SDK; long-lived instance created at startup, passed into `MtgjsonProvider`; card queries go directly to the SDK (`apps/server`)
- **`google-auth-library`** — Google ID token verification (`apps/server`); verifies audience, expiry, `email_verified` claim
- **`jsonwebtoken`** — HS256 session JWT issuance and verification (`apps/server/src/auth/sessionJwt.ts`)
- **`fastify-plugin`** — used by auth plugin to share `request.identity` decoration across Fastify scopes
- **`@fastify/aws-lambda`** v6 — Lambda adapter wrapping the Fastify app (`apps/server/src/lambda.ts`)
- **AWS CDK v2** (`aws-cdk-lib`) — infrastructure as code in `packages/infrastructure`; CDK app entry is `bin/app.ts`, executed via `node --import tsx` (no `ts-node`). Per-environment scripts `pnpm cdk:<env>:{synth,diff,deploy,destroy}` load `packages/infrastructure/.env.<env>` with Node 22's `--env-file` flag — `ENVIRONMENT` is required and suffixes every physical resource name; `REUSE_ORPHANS=true` imports retained secrets instead of creating them
- **EFS** — persistent storage for DuckDB file (`binder.duckdb`) and MTGJSON SDK parquet cache (`mtgjson-cache/`) on Lambda; `mtgjsonCacheDir` derived from `EFS_PATH` env var when set
- **NAT instance** (`t4g.nano`, ~$3/month) — replaces Managed NAT Gateway (~$32/month); provisioned via `ec2.NatProvider.instanceV2()` in the CDK stack; provides Lambda internet access for MTGJSON downloads and Google OAuth
- **Secrets Manager** — all 3 secrets created by CDK (`RemovalPolicy.RETAIN`); `SESSION_JWT_SECRET` is auto-generated; `GOOGLE_CLIENT_IDS` and `GOOGLE_WEB_CLIENT_ID` are created with `REPLACE_ME` placeholder and must be overwritten manually after first deploy via `aws secretsmanager put-secret-value`
- TypeScript 5, Node 22 + Fastify v4, TypeORM 0.3.x, `pg` (PostgreSQL driver), `reflect-metadata` (011-postgres-migration)
- AWS Aurora Serverless V2 PostgreSQL 17 — public subnet, developer-accessible (011-postgres-migration)
- Jest 29 + ts-jest 29 + @types/jest — test framework for `apps/server` (013-migrate-jest-tests)

## Recent Changes
- Adopted TypeScript 5 (strict) project-wide — replaces JavaScript + JSDoc approach
- Adopted pnpm monorepo with Turborepo: `apps/server`, `apps/mobile`, `packages/core`
- **007-google-oauth-auth**: Added Google OAuth + guest mode — `POST /auth/google`, `GET /auth/me`, `POST /auth/signout`; auth plugin decorates `request.identity`; users table in DuckDB; session JWTs (HS256, 7-day TTL)
- **009-infrastructure**: Added AWS CDK v2 stack (`packages/infrastructure`) — Lambda + API Gateway + EFS + ECR
- **010-revert-mtgjson-infra**: `MtgjsonProvider` now calls the MTGJSON SDK directly for all card operations; removed DuckDB card replica tables (migrations 003/004), `cardImporter.ts`, and EFS lock-file coordination; SDK instance kept alive between Lambda invocations; EFS used for SDK parquet cache only
- **Env file convention**: `apps/server` now uses Node's `--env-file` flag to load env vars. Added `.env.local` (local dev, loaded by `pnpm dev`/`pnpm start`), `.env.dev`, `.env.staging`, `.env.prod`. Only `.env.example` is committed — all others are gitignored. `.env.example` documents the new Postgres vars (`DATABASE_URL`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_SECRET_NAME`)
- **Turbo migration tasks**: added `migration:generate`, `migration:run`, `migration:revert` to `turbo.json` with `cache: false` and `dependsOn: ["^build"]` so TypeORM CLI operations run through Turbo with the right build order and no unsafe caching
