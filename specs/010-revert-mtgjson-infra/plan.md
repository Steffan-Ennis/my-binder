# Implementation Plan: Revert MTGJSON Infrastructure Replication

**Branch**: `010-revert-mtgjson-infra` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-revert-mtgjson-infra/spec.md`

## Summary

Revert the `MtgjsonProvider` from querying DuckDB-replicated card tables back to calling the MTGJSON SDK directly. Remove the card data import pipeline (`cardImporter.ts`, migrations 003/004). Configure the SDK's cache directory to use the EFS-connected volume in production, so downloaded card data persists across Lambda cold starts.

## Technical Context

**Language/Version**: TypeScript 5, Node 22
**Primary Dependencies**: `mtgjson-sdk@0.1.1`, `@duckdb/node-api` (app DB only — user collection), `fastify@4`
**Storage**: DuckDB (app data only, `binder.duckdb`); EFS volume for SDK parquet cache
**Testing**: `node:test` built-in test runner
**Target Platform**: AWS Lambda (production), local Node 22 (development)
**Project Type**: Web service (Fastify API within pnpm monorepo)
**Performance Goals**: Cold-start SDK initialisation < 30 s (first run, EFS download); warm invocations unaffected
**Constraints**: SDK instance kept alive between Lambda invocations (long-lived connection); EFS mount at `/mnt/efs` in production
**Scale/Scope**: Single Lambda function; single SDK instance per container

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Simplicity First | ✅ PASS | This change **reduces** complexity — removes import pipeline, migrations, lock files |
| II. Data Integrity | ✅ PASS | No user collection data is touched; SDK is read-only from app's perspective |
| III. Test-First Development | ✅ PASS | Existing tests cover `CardProvider` contract; new provider implementation must be test-driven. Tests co-located at `src/providers/mtgjson/index.test.ts` |
| IV. Single Responsibility | ✅ PASS | Provider has one responsibility: adapt SDK to `CardProvider` interface |
| V. Transparency & Legibility | ✅ PASS | SDK calls are direct and named; no magic |
| VI. Layered Architecture | ✅ PASS | SDK access remains behind `CardProvider` abstraction; routes unchanged |
| VII. Strong Typing | ✅ PASS | SDK is fully typed; `CardSet`, `Legalities`, `Identifiers` are all concrete types. `strict: true` enforced |

No violations — Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/010-revert-mtgjson-infra/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── card-provider.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes

```text
apps/server/
├── src/
│   ├── providers/
│   │   └── mtgjson/
│   │       └── index.ts          ← REWRITE: use MtgjsonSDK instead of DuckDB queries
│   ├── db/
│   │   ├── cardImporter.ts       ← DELETE
│   │   └── migrations/
│   │       ├── 003_card_import_metadata.sql  ← DELETE
│   │       └── 004_card_tables.sql           ← DELETE
│   ├── app.ts                    ← MODIFY: remove import step; change SDK init
│   └── config.ts                 ← MODIFY: derive mtgjsonCacheDir from EFS_PATH when present
└── docs/
    └── deployment.md             ← UPDATE: remove import pipeline section; add EFS cache notes
```

No changes to `packages/infrastructure` — EFS mount is already provisioned. The CDK stack's Lambda environment variable `MTGJSON_CACHE_DIR` is replaced by EFS-path derivation in the config layer; alternatively, the CDK can set `MTGJSON_CACHE_DIR` explicitly to the EFS subdirectory path.

## Implementation Tasks (high-level, for `/speckit.tasks`)

1. **Rewrite `MtgjsonProvider`** — implement `lookup`, `checkLegality`, `search`, `isReachable` using SDK calls. Write tests first (`index.test.ts`). Close SDK on `provider.close()`.
2. **Update `app.ts`** — replace the "download then import" startup sequence with a single `MtgjsonSDK.create({ cacheDir })` that is passed to the provider. Remove `importCardDataIfStale` call.
3. **Update `config.ts`** — derive `mtgjsonCacheDir` from `EFS_PATH` env var when present.
4. **Delete removed files** — `cardImporter.ts`, migrations 003 and 004.
5. **Update `db/client.ts`** — remove migration file references for 003 and 004 from the migration runner.
6. **Update docs** — update `apps/server/docs/deployment.md` to reflect the simplified startup.

## Complexity Tracking

No violations — not required.
