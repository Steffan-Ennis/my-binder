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
- **`@duckdb/node-api`** — DuckDB Node.js driver (`apps/server`)
- **`mtgjson-sdk`** — MTGJSON card data SDK; ships compiled JS + `.d.ts` (`apps/server`)
- **DuckDB** — embedded file-based database; Docker volume mount at `DB_PATH`
- **`google-auth-library`** — Google ID token verification (`apps/server`); verifies audience, expiry, `email_verified` claim
- **`jsonwebtoken`** — HS256 session JWT issuance and verification (`apps/server/src/auth/sessionJwt.ts`)
- **`fastify-plugin`** — used by auth plugin to share `request.identity` decoration across Fastify scopes
- **`@fastify/aws-lambda`** v6 — Lambda adapter wrapping the Fastify app (`apps/server/src/lambda.ts`)
- **AWS CDK v2** (`aws-cdk-lib`) — infrastructure as code in `packages/infrastructure`
- **EFS** — persistent storage for DuckDB file and MTGJSON parquet cache on Lambda
- TypeScript 5, Node 22 + `mtgjson-sdk@0.1.1`, `@duckdb/node-api` (app DB only — user collection), `fastify@4` (010-revert-mtgjson-infra)
- DuckDB (app data only, `binder.duckdb`); EFS volume for SDK parquet cache (010-revert-mtgjson-infra)

## Recent Changes
- Adopted TypeScript 5 (strict) project-wide — replaces JavaScript + JSDoc approach
- Adopted pnpm monorepo with Turborepo: `apps/server`, `apps/mobile`, `packages/core`
- **007-google-oauth-auth**: Added Google OAuth + guest mode — `POST /auth/google`, `GET /auth/me`, `POST /auth/signout`; auth plugin decorates `request.identity`; users table in DuckDB; session JWTs (HS256, 7-day TTL)
