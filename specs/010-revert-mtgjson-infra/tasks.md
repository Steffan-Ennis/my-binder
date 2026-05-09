# Tasks: Revert MTGJSON Infrastructure Replication

**Input**: Design documents from `/specs/010-revert-mtgjson-infra/`
**Branch**: `010-revert-mtgjson-infra` | **Date**: 2026-03-30

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

No new dependencies are needed — `mtgjson-sdk@0.1.1` is already installed in `apps/server/package.json`. No package changes required for this revert.

_No code tasks — proceed to Phase 2._

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Update the config layer before anything else. `app.ts` (Phase 3) must read the correct EFS-backed `mtgjsonCacheDir`, so this change must land first.

**⚠️ CRITICAL**: Phase 3 (US1 app.ts update) depends on this phase being complete.

- [X] T001 Update `apps/server/src/config.ts`: when `EFS_PATH` env var is set, derive `mtgjsonCacheDir = path.join(EFS_PATH, 'mtgjson-cache')`; otherwise fall through to `MTGJSON_CACHE_DIR` env var (default: `./data/mtgjson-cache`); use the existing `loadConfig()` function — no new fields are added to the `Config` type

**Checkpoint**: Config updated — Phase 3 and Phase 4 can now proceed.

---

## Phase 3: User Story 1 — Card Search Uses SDK Directly (Priority: P1) 🎯 MVP

**Goal**: `MtgjsonProvider` calls the MTGJSON SDK directly for all card operations, eliminating the DuckDB replica query path entirely.

**Independent Test**: Start the server, perform `GET /cards/lookup?name=Lightning+Bolt` — results returned from SDK with no card import step running.

### Implementation for User Story 1

- [X] T002 [P] [US1] Rewrite `apps/server/src/providers/mtgjson/index.ts`: implement `lookup`, `checkLegality`, `search`, and `isReachable` using `MtgjsonSDK` calls per `contracts/card-provider.md` and `research.md`; constructor accepts a live `MtgjsonSDK` instance; `close()` delegates to `sdk.close()`; use existing `mapCardSetToCardRecord` mapper unchanged; apply paper-availability filter on all search/lookup calls; apply in-process colour-identity subset filter in `search()`
- [X] T003 [US1] Update `apps/server/src/app.ts`: replace `importCardDataIfStale` startup call with `await MtgjsonSDK.create({ cacheDir: config.mtgjsonCacheDir })`; pass the SDK instance into `new MtgjsonProvider(sdk)`; remove all imports and references to `cardImporter` (depends on T001, T002)

**Checkpoint**: Provider rewritten and wired to SDK — `GET /cards/lookup`, `GET /cards/legality`, and `POST /cards/search` all served by the MTGJSON SDK.

---

## Phase 4: User Story 2 — SDK Cache Persisted on EFS Volume (Priority: P2)

**Goal**: In production, the SDK's `cacheDir` is set to the EFS-mounted path so downloaded card data survives Lambda cold starts and is shared across invocations without re-downloading.

**Independent Test**: Trigger two sequential Lambda cold starts; confirm the second start serves card requests immediately without re-downloading parquet files.

> **Note**: The core deliverables for US2 are T001 (config.ts — Phase 2) and T003 (app.ts SDK init — Phase 3). This phase contains the verification step only.

- [X] T004 [US2] Verify EFS cache wiring end-to-end: confirm `apps/server/src/config.ts` derives `mtgjsonCacheDir` from `EFS_PATH` when set, and that `apps/server/src/app.ts` passes this value to `MtgjsonSDK.create({ cacheDir })`; run `pnpm turbo typecheck` from repo root and confirm zero type errors (no code changes expected — verification only)

**Checkpoint**: EFS cache path correctly derived in config and passed to SDK on startup.

---

## Phase 5: User Story 3 — Card Import Machinery Removed (Priority: P3)

**Goal**: `cardImporter.ts` and card data migrations 003/004 are completely removed. The server builds and starts with no reference to the card import pipeline.

**Independent Test**: Run `pnpm turbo build` — succeeds with no references to the card importer module, migration 003, or migration 004.

### Implementation for User Story 3

- [X] T005 [P] [US3] Delete `apps/server/src/db/cardImporter.ts`
- [X] T006 [P] [US3] Delete `apps/server/src/db/migrations/003_card_import_metadata.sql`
- [X] T007 [P] [US3] Delete `apps/server/src/db/migrations/004_card_tables.sql`
- [X] T008 [US3] Remove the migration 003 and 004 file references from the migration runner in `apps/server/src/db/client.ts` — remove the require/import entries and their entries from the ordered migration list (depends on T005, T006, T007)
- [X] T009 [US3] Confirm zero remaining references to the removed files: search `apps/server/src/` for `cardImporter`, `003_card`, `004_card`, and `importCardData`; build must pass cleanly after T008

**Checkpoint**: Build succeeds — no references to the removed card import pipeline remain in the codebase.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 [P] Update `apps/server/docs/deployment.md`: remove the card import pipeline section; add a note explaining that on first cold start the SDK downloads parquet files (~200 MB) to the EFS-backed `mtgjson-cache` subdirectory; subsequent starts read from the existing EFS cache
- [X] T011 Run the full server test suite: `cd apps/server && pnpm test` — all existing card route and provider tests must pass without modifying test assertions
- [X] T012 Run the full monorepo build: `pnpm turbo build` from repo root — zero TypeScript errors across all workspaces

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — but has no tasks; proceed immediately to Phase 2
- **Foundational (Phase 2)**: No upstream dependencies — **BLOCKS** Phase 3 (T003 needs updated `config.mtgjsonCacheDir`)
- **US1 (Phase 3)**: Depends on Phase 2; T002 and T003 are sequential (T002 first)
- **US2 (Phase 4)**: Delivered by T001 (Phase 2) + T003 (Phase 3); T004 is verification only — can run after Phase 3
- **US3 (Phase 5)**: Independent of Phases 3–4; T005/T006/T007 can run in parallel as soon as Phase 2 is complete (earlier if desired); T008 depends on T005/T006/T007; T009 depends on T008
- **Polish (Phase 6)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (config.ts). T002 [P] and T003 sequential.
- **US2 (P2)**: Fully delivered by T001 + T003. T004 is a no-code verification step.
- **US3 (P3)**: Independent of US1/US2 — can proceed in a parallel stream from Phase 2 onward.

### Parallel Opportunities

- T002 (provider rewrite) and T005/T006/T007 (deletions) can run in parallel after T001
- T005, T006, T007 can run in parallel with each other (different files)
- T010 (docs) can run in parallel with T011/T012 (testing)

---

## Parallel Example: US1 + US3 in parallel

```bash
# Stream A — US1 (after T001):
T002: Rewrite apps/server/src/providers/mtgjson/index.ts
T003: Update apps/server/src/app.ts

# Stream B — US3 (after Phase 1, independent):
T005: Delete apps/server/src/db/cardImporter.ts
T006: Delete apps/server/src/db/migrations/003_card_import_metadata.sql
T007: Delete apps/server/src/db/migrations/004_card_tables.sql
T008: Update apps/server/src/db/client.ts (after T005/T006/T007)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. T001: Update `config.ts` (EFS_PATH derivation)
2. T002: Rewrite `MtgjsonProvider` (SDK calls)
3. T003: Update `app.ts` (SDK.create startup)
4. **Validate**: `cd apps/server && pnpm test` — all card tests pass
5. MVP done — card search, lookup, and legality all served by SDK directly

### Incremental Delivery

1. T001 → Config foundation ready
2. T002 → T003 → US1 complete (card search uses SDK)
3. T004 → US2 verified (EFS persistence confirmed end-to-end)
4. T005–T009 → US3 complete (import machinery removed)
5. T010–T012 → Polish complete

---

## Notes

- [P] tasks operate on different files and have no inter-task dependencies
- Existing `apps/server/src/providers/interface.ts` (`CardProvider` type) is **not modified**
- Existing `mapCardSetToCardRecord` mapper is **not modified**
- No drop migration is needed for existing `binder.duckdb` files — card tables from 003/004 remain on disk but are never queried
- EFS lock-file coordination (added in spec 009 for the DuckDB import) is removed with `cardImporter.ts` — no replacement coordination is needed because the SDK manages its own DuckDB instance
