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
pnpm turbo test      # Run tests across all workspaces
pnpm turbo build     # Build all workspaces (core first)
pnpm turbo typecheck # Run tsc --noEmit across all workspaces
pnpm turbo dev       # Start all dev servers
```

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
- **DuckDB** — embedded file-based database for user collection only; card data lives in the SDK's own internal DuckDB instance
- **`google-auth-library`** — Google ID token verification (`apps/server`); verifies audience, expiry, `email_verified` claim
- **`jsonwebtoken`** — HS256 session JWT issuance and verification (`apps/server/src/auth/sessionJwt.ts`)
- **`fastify-plugin`** — used by auth plugin to share `request.identity` decoration across Fastify scopes
- **`@fastify/aws-lambda`** v6 — Lambda adapter wrapping the Fastify app (`apps/server/src/lambda.ts`)
- **AWS CDK v2** (`aws-cdk-lib`) — infrastructure as code in `packages/infrastructure`
- **EFS** — persistent storage for DuckDB file (`binder.duckdb`) and MTGJSON SDK parquet cache (`mtgjson-cache/`) on Lambda; `mtgjsonCacheDir` derived from `EFS_PATH` env var when set
- **NAT instance** (`t4g.nano`, ~$3/month) — replaces Managed NAT Gateway (~$32/month); provisioned via `ec2.NatProvider.instanceV2()` in the CDK stack; provides Lambda internet access for MTGJSON downloads and Google OAuth
- **Secrets Manager** — all 3 secrets created by CDK (`RemovalPolicy.RETAIN`); `SESSION_JWT_SECRET` is auto-generated; `GOOGLE_CLIENT_IDS` and `GOOGLE_WEB_CLIENT_ID` are created with `REPLACE_ME` placeholder and must be overwritten manually after first deploy via `aws secretsmanager put-secret-value`

## Recent Changes
- Adopted TypeScript 5 (strict) project-wide — replaces JavaScript + JSDoc approach
- Adopted pnpm monorepo with Turborepo: `apps/server`, `apps/mobile`, `packages/core`
- **007-google-oauth-auth**: Added Google OAuth + guest mode — `POST /auth/google`, `GET /auth/me`, `POST /auth/signout`; auth plugin decorates `request.identity`; users table in DuckDB; session JWTs (HS256, 7-day TTL)
- **009-infrastructure**: Added AWS CDK v2 stack (`packages/infrastructure`) — Lambda + API Gateway + EFS + ECR
- **010-revert-mtgjson-infra**: `MtgjsonProvider` now calls the MTGJSON SDK directly for all card operations; removed DuckDB card replica tables (migrations 003/004), `cardImporter.ts`, and EFS lock-file coordination; SDK instance kept alive between Lambda invocations; EFS used for SDK parquet cache only
