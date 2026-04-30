# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**my-binder** is a personal card binder application (TypeScript 5 strict, Node 22).

## Monorepo Structure

This is a **pnpm + Turborepo monorepo**. Workspaces:

| Path | Package | Purpose |
|------|---------|---------|
| `apps/server` | `@my-binder/server` | Fastify API server (spec 001) |
| `packages/core` | `@my-binder/core` | Shared schemas, types, constants |
| `packages/infrastructure` | `@my-binder/infrastructure` | AWS CDK stack — Lambda, API Gateway, EFS, RDS (spec 009) |

> The mobile workspace `apps/mobile` (spec 002) is planned but not yet implemented.

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
- `apps/server` is deployed to AWS Lambda via the CDK stack in `packages/infrastructure` (spec 009).

## Active Technologies
- **TypeScript 5** (`strict: true`) — project-wide language for all workspaces
- **Node 22** — server runtime (`apps/server`)
- **Fastify v4** — HTTP framework with Ajv JSON schema validation (`apps/server`)
- **PostgreSQL + TypeORM** — primary store for users and card collection; repository pattern with TypeORM-generated migrations applied manually via the CLI (spec 011)
- **`mtgjson-sdk`** — MTGJSON card data SDK; sole source of truth for card lookup, search, and legality (spec 010)
- **`@duckdb/node-api`** — retained only as the MTGJSON SDK's parquet cache backend (spec 011 FR-006)
- **Google OAuth (`google-auth-library`)** — sign-in with allowlist gate stored in the `allowed_users` table (spec 011)
- **Jest** — server test runner, replaces `node:test` (spec 013)
- **AWS Lambda + API Gateway HTTP API** — production runtime, defined via CDK (spec 009)
- **AWS EFS** — Lambda-mounted persistent volume backing the MTGJSON SDK cache (specs 009 + 010)
- **AWS RDS PostgreSQL** — public-subnet instance for direct developer access via psql (spec 011)

## Recent Changes
- Migrated server tests from `node:test` to Jest to fix broken third-party module mocking (spec 013)
- Migrated user and collection storage from DuckDB to PostgreSQL via TypeORM (spec 011)
- Reverted MTGJSON DuckDB import pipeline; SDK is the source of truth, EFS holds its parquet cache (spec 010)
- Adopted AWS Lambda + API Gateway + EFS deployed via AWS CDK in `packages/infrastructure` (spec 009)
