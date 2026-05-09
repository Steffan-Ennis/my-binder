# Tasks: Infrastructure

**Input**: Design documents from `/specs/009-infrastructure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/deployment.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — CDK project and new server dependencies

- [X] T001 Create pnpm workspace package at `packages/infrastructure/` — `package.json` (name: `@my-binder/infrastructure`), `tsconfig.json` (strict: true, moduleResolution: NodeNext), `cdk.json` (app: `npx ts-node bin/app.ts`). Add to pnpm workspace (already covered by `packages/*` glob in `pnpm-workspace.yaml`).
- [X] T002 Add `@fastify/aws-lambda` v6 dependency to `apps/server/package.json`

---

## Phase 2: Foundational (Card Import System + DuckDB Config)

**Purpose**: Card import infrastructure that MUST be complete before user stories. This phase changes how card data is stored — from SDK direct parquet queries to imported DuckDB tables. Works locally and on Lambda identically.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `SET temp_directory` to DuckDB init in `apps/server/src/db/client.ts` — set to `/tmp` in production, OS temp dir locally. Prevents EFS stale file handle errors.
- [X] T004 [P] Create migration `apps/server/src/db/migrations/003_card_import_metadata.sql` — `card_import_metadata` table with `id`, `last_import_at`, `parquet_mtime`, `parquet_count` columns per data-model.md
- [X] T005 [P] Create migration `apps/server/src/db/migrations/004_card_tables.sql` — card data tables matching the MTGJSON parquet schema (cards, identifiers, legalities). Schema must support the queries currently made by `MtgjsonProvider` methods (`lookup`, `search`, `checkLegality`, `enrichCard`).
- [X] T006 Implement card importer module at `apps/server/src/db/cardImporter.ts` — reads parquet files from `MTGJSON_CACHE_DIR`, imports into DuckDB card tables, tracks timestamps in `card_import_metadata`. Includes lock file acquisition/release for concurrent rebuild coordination (see research.md R10 for pattern). Exports `importCardDataIfStale(db, cacheDir, efsPath?)` function.
- [X] T007 Modify `MtgjsonProvider` in `apps/server/src/providers/mtgjson/index.ts` — replace SDK direct parquet queries with DuckDB queries against the imported card tables. The SDK is still used for parquet download/cache management (`MtgjsonSDK.create({ cacheDir })`) but NOT for card lookups. Update `lookup`, `search`, `checkLegality`, `enrichCard`, `isReachable` methods to query DuckDB.
- [X] T008 Wire card importer into server startup in `apps/server/src/index.ts` (or equivalent init path) — after `initDb()` and migrations, call `importCardDataIfStale()`. SDK init (`MtgjsonSDK.create()`) should run before import to ensure parquet files are downloaded/cached.

**Checkpoint**: Server runs locally with card data imported into DuckDB. `pnpm turbo dev` starts, SDK downloads parquet on first run, card importer populates DuckDB tables, existing API endpoints return card data from DuckDB queries. No AWS resources needed.

---

## Phase 3: User Story 1 — Developer Packages Server as Lambda Function (Priority: P1) 🎯 MVP

**Goal**: Wrap the existing Fastify app with `@fastify/aws-lambda`, create a container image, and verify locally.

**Independent Test**: Build the container, invoke the Lambda handler locally with a simulated API Gateway event, and verify a correct API response.

### Implementation for User Story 1

- [X] T009 [US1] Create Lambda handler entry point at `apps/server/src/lambda.ts` — import the Fastify app builder, wrap with `@fastify/aws-lambda` `awsLambdaFastify()`, export the handler. Must run card import during Lambda init phase (outside handler, 15-minute timeout) per research.md R3.
- [X] T010 [US1] Create multi-stage Dockerfile at `apps/server/Dockerfile` — base image `public.ecr.aws/lambda/nodejs:22`, use `pnpm deploy --prod` to flatten monorepo deps, copy compiled server code + node_modules. Do NOT bundle parquet files in image (SDK downloads to EFS). Mark `@duckdb/node-bindings*` as included (not externalized). See research.md R2.
- [ ] T011 [US1] Verify Lambda handler locally — build container with `docker build`, run with `docker run -p 9000:8080`, invoke with `curl` simulated API Gateway event per quickstart.md Scenario 1. Confirm health check and card search responses.

**Checkpoint**: Lambda container builds and responds correctly to simulated API Gateway events locally. Card data is downloaded by SDK and imported into DuckDB inside the container.

---

## Phase 4: User Story 2 — Developer Manually Deploys Server to Hosted Environment (Priority: P2)

**Goal**: Define all AWS infrastructure in CDK, deploy, and access the server at a stable HTTPS URL.

**Independent Test**: Run `cdk deploy`, then `curl` the API Gateway URL and receive a valid response over HTTPS.

### Implementation for User Story 2

- [X] T012 [US2] Implement CDK stack at `packages/infrastructure/lib/my-binder-stack.ts` — VPC (2 AZs, private subnets, NAT Gateway), EFS (General Purpose, Elastic throughput, access point at `/lambda` with POSIX 1001:1001), Lambda (`DockerImageFunction` from `apps/server/Dockerfile`, 1024MB memory, 1-2GB ephemeral `/tmp`, VPC-attached, EFS mount at `/mnt/data`, 60s timeout), API Gateway HTTP API (`$default` route, `HttpLambdaIntegration`, payload v2.0), ECR repo (lifecycle: keep 5 images), Secrets Manager references. See research.md R4-R8 and data-model.md for resource specs.
- [X] T013 [US2] Create CDK app entry point at `packages/infrastructure/bin/app.ts` — instantiate `MyBinderStack`, configure AWS account/region from environment.
- [X] T014 [US2] Set Lambda environment variables in CDK stack — `DB_PATH=/mnt/data/db/binder.duckdb`, `MTGJSON_CACHE_DIR=/mnt/data/mtgjson-cache`, `NODE_ENV=production`, `CARD_PROVIDER=mtgjson`, `EFS_PATH=/mnt/data`. Wire Secrets Manager values for `SESSION_JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `GOOGLE_WEB_CLIENT_ID`.
- [X] T015 [US2] Add CDK stack outputs — `ApiUrl` (API Gateway endpoint URL), `EcrRepositoryUri`, `LambdaFunctionName`. Used by deployment verification commands in contracts/deployment.md.
- [X] T016 [US2] Create deployment documentation at `apps/server/docs/deployment.md` — prerequisites, first-time setup (secrets, bootstrap), deploy command, verify command, update command. Reference contracts/deployment.md.

**Checkpoint**: `cdk deploy` provisions all resources. Server accessible at `https://<id>.execute-api.<region>.amazonaws.com/health` over HTTPS. Card data bootstraps on first invocation (SDK download + import).

---

## Phase 5: User Story 3 — Server Accesses Card Data from Persistent Storage (Priority: P3)

**Goal**: Verify the full cold start flow — EFS-persisted parquet and DuckDB survive across Lambda invocations, timestamp-based rebuild works, lock file prevents concurrent corruption.

**Independent Test**: Force a cold start on deployed Lambda, verify card data is available. Force a second cold start, verify no re-import (timestamps current). This story is primarily an integration verification of Phase 2 (card import) + Phase 4 (EFS deployment).

### Implementation for User Story 3

- [ ] T017 [US3] Verify first cold start on deployed Lambda — invoke the function, confirm SDK downloads parquet to EFS, card importer populates DuckDB, card search endpoint returns results. Measure latency (target: <60s for first cold start per quickstart.md Scenario 3).
- [ ] T018 [US3] Verify subsequent cold start with cached data — force cold start (update env var), invoke function, confirm parquet NOT re-downloaded and card tables NOT rebuilt (timestamp check passes). Measure latency (target: <15s per quickstart.md Scenario 4).
- [ ] T019 [US3] Verify warm invocation reuse — send multiple rapid requests, confirm connection and data reused without re-init.

**Checkpoint**: Card data persists on EFS across Lambda invocations. Cold starts with cached data are fast (<15s). Warm invocations are sub-second.

---

## Phase 6: User Story 4 — Server Incurs No Cost When Idle (Priority: P4)

**Goal**: Confirm no compute charges when idle. This is a verification-only phase — Lambda's pay-per-invocation model provides this by default.

**Independent Test**: Review CDK stack configuration — no provisioned concurrency, no scheduled events, no CloudWatch alarms triggering invocations.

### Implementation for User Story 4

- [ ] T020 [US4] Verify CDK stack has no provisioned concurrency, no scheduled warming events, no always-on resources beyond EFS and Secrets Manager. Confirm expected fixed monthly cost: ~$1.50-2.00 (EFS storage + Secrets Manager) per research.md cost analysis.

**Checkpoint**: Infrastructure has zero compute cost at rest. Only fixed costs are EFS storage (pennies) and Secrets Manager ($1.20/month).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation, and validation

- [X] T021 [P] Clean up duplicate 009-infrastructure entries in `CLAUDE.md` Active Technologies section (agent context script added redundant lines)
- [ ] T022 [P] Run quickstart.md Scenario 5 (local development) — verify `pnpm turbo dev` starts, SDK downloads parquet, card import runs, endpoints work. No AWS resources.
- [X] T023 Update spec.md status from Draft to Complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — Lambda packaging needs card import logic
- **US2 (Phase 4)**: Depends on Phase 3 — CDK deploys the container image from US1
- **US3 (Phase 5)**: Depends on Phase 4 — integration verification needs deployed infrastructure
- **US4 (Phase 6)**: Depends on Phase 4 — cost verification needs deployed infrastructure
- **Polish (Phase 7)**: Can start after Phase 4; T023 after all phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) only
- **US2 (P2)**: Depends on US1 (needs the Dockerfile and lambda.ts from US1)
- **US3 (P3)**: Depends on US2 (needs deployed EFS to verify persistence)
- **US4 (P4)**: Depends on US2 (needs deployed stack to verify cost model)
- **US3 and US4**: Can run in parallel after US2

### Within Each Phase

- Tasks marked [P] can run in parallel
- Sequentially ordered tasks depend on prior tasks in the same phase

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 2**: T004 and T005 can run in parallel (different migration files); T003 is independent
- **Phase 5 + 6**: US3 and US4 verification can run in parallel after US2
- **Phase 7**: T021 and T022 can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```
# Parallel batch 1 (independent files):
T003: DuckDB temp_directory config in client.ts
T004: Migration 003_card_import_metadata.sql
T005: Migration 004_card_tables.sql

# Sequential (depends on T004, T005):
T006: Card importer module (needs migration schemas)

# Sequential (depends on T006):
T007: Modify MtgjsonProvider (needs card importer and tables)

# Sequential (depends on T007):
T008: Wire into server startup
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (card import system — works locally)
3. Complete Phase 3: User Story 1 (Lambda packaging)
4. **STOP and VALIDATE**: Build container, test Lambda handler locally
5. Local card import + Lambda packaging proven before touching AWS

### Incremental Delivery

1. Setup + Foundational → Card data in DuckDB, works locally
2. Add US1 → Lambda container builds and runs locally (MVP!)
3. Add US2 → Deployed to AWS, accessible via HTTPS
4. Add US3 → Verified: EFS persistence, cold start behavior
5. Add US4 → Verified: zero cost when idle
6. Each story adds deployment confidence without breaking prior work

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The card import system (Phase 2) is the largest implementation effort
- US3 and US4 are primarily verification/integration phases
- Parquet files are NOT bundled in the container — SDK downloads to EFS (or local disk)
- Same server code runs locally and on Lambda — no conditional branching
- Constitution requires documentation step per task — deployment.md covers US2, existing docs suffice elsewhere
