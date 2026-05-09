# Implementation Plan: Infrastructure

**Branch**: `009-infrastructure` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-infrastructure/spec.md`

## Summary

Deploy the existing Fastify server to AWS using Lambda + API Gateway HTTP API, with a single DuckDB database file on EFS containing both user data and imported card data. The MTGJSON SDK downloads parquet files to an EFS-backed cache directory; card tables are imported into DuckDB and rebuilt only when parquet timestamps change. A lock file coordinates concurrent rebuilds. The same code runs locally without AWS resources, using `DB_PATH` and `MTGJSON_CACHE_DIR` environment variables. CDK infrastructure lives in `packages/infrastructure` as a pnpm workspace package.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js 22
**Primary Dependencies**: Fastify v4, `@fastify/aws-lambda` v6, `@duckdb/node-api`, `mtgjson-sdk`, AWS CDK v2 (`aws-cdk-lib`)
**Storage**: DuckDB (single file-based database on EFS in Lambda, local disk in development)
**Testing**: Vitest (existing server tests), manual Lambda invocation for integration
**Target Platform**: AWS Lambda (container image) + API Gateway HTTP API; local development on macOS/Linux
**Project Type**: Web service (API server) + infrastructure package
**Performance Goals**: Cold start <15s (cached); warm response <1s; card data rebuild <3 minutes
**Constraints**: 29s API Gateway timeout; Lambda 10GB container limit; EFS latency (5-10x /tmp); no CI/CD
**Scale/Scope**: Single user, personal project, ~2 hours active use/day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | PASS | Lambda + API Gateway is the simplest viable hosting. Single DuckDB file avoids managing multiple databases. No CI/CD, no custom domain, no provisioned concurrency. |
| II. Data Integrity | PASS | User data persists on EFS. Card data is rebuildable from parquet. Lock file prevents concurrent write corruption. Timestamp check prevents stale imports. |
| III. Test-First Development | PASS | Lambda handler testable locally via simulated events. Existing tests continue to work with `:memory:` DuckDB in test mode. |
| IV. Single Responsibility | PASS | CDK code in `packages/infrastructure` is separated from app code. Lambda adapter is a thin wrapper. Card importer is a distinct module. |
| V. Transparency & Legibility | PASS | All infrastructure defined as code (CDK). Deployment steps documented. Environment variables explicit. |
| VI. Layered Architecture | PASS | No layer violations. Lambda adapter wraps existing Fastify app without changing internal architecture. Card data still accessed through provider abstraction. |
| VII. Strong Typing & Schema Validation | PASS | CDK code is TypeScript strict. Lambda adapter is typed. No new API boundaries introduced (Fastify routes unchanged). |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| 4th pnpm workspace (`packages/infrastructure`) | CDK infrastructure has its own deps (`aws-cdk-lib`, `aws-cdk-lib/aws-*`), build step (`tsc`), and deploy lifecycle separate from the server. Collocating in `apps/server` would mix deployment tooling with application code. | A standalone `infra/` outside pnpm workspaces was considered but rejected: the user explicitly requested `packages/infrastructure` and pnpm workspace membership gives consistent `pnpm install`, `pnpm build`, and Turborepo task integration at no added complexity cost. |

## Project Structure

### Documentation (this feature)

```text
specs/009-infrastructure/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── deployment.md    # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/infrastructure/          # NEW — pnpm workspace, CDK infrastructure
├── package.json                  #   name: @my-binder/infrastructure
├── tsconfig.json                 #   strict: true, module: NodeNext
├── cdk.json                      #   app: "npx ts-node bin/app.ts"
├── bin/
│   └── app.ts                    #   CDK app entry point
└── lib/
    └── my-binder-stack.ts        #   Stack: Lambda, API Gateway, EFS, VPC, Secrets

apps/server/
├── src/
│   ├── db/
│   │   ├── client.ts             # MODIFIED — add SET temp_directory after connection open
│   │   ├── cardImporter.ts       # NEW — parquet → DuckDB import, timestamp check, lock file
│   │   └── migrations/
│   │       ├── 001_create_cards.sql     # existing
│   │       ├── 002_create_users.sql     # existing
│   │       ├── 003_card_import_metadata.sql  # NEW
│   │       └── 004_card_tables.sql           # NEW
│   ├── providers/
│   │   └── mtgjson/
│   │       └── index.ts          # MODIFIED — DuckDB queries instead of SDK direct parquet reads
│   ├── config.ts                 # unchanged — DB_PATH, MTGJSON_CACHE_DIR already present
│   └── lambda.ts                 # NEW — Lambda handler entry point (@fastify/aws-lambda)
├── Dockerfile                    # NEW — multi-stage Lambda container image
└── docs/
    └── deployment.md             # NEW — manual deployment steps
```

**Structure Decision**: `packages/infrastructure` is a full pnpm workspace package (`packages/*` glob already covers it). It is not consumed by `apps/*` as a library — it is deployed independently via `cdk deploy`. Turborepo `build` task compiles its TypeScript; CDK deploy is a manual step outside Turborepo's task graph.
