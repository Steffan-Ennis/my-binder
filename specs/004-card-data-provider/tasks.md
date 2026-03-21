# Tasks: Card Data Provider (Backend)

**Input**: Design documents from `/specs/004-card-data-provider/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓
**Scope**: Backend implementation only — provider abstraction layer, MTGJSON integration, and HTTP API endpoints

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Install SDK dependency and extend configuration for provider selection.

- [x] T001 Install `mtgjson-sdk` dependency in `apps/server/package.json` via `pnpm add mtgjson-sdk`
- [x] T002 Add `cardProvider` field (`string`, default `"mtgjson"`) to `Config` type and `loadConfig()` from `CARD_PROVIDER` env var in `apps/server/src/config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared domain types, provider interface, and registry that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add `CardRecord`, `Printing`, `LegalityResult`, `SearchQuery`, `SearchResult`, `ProviderInfo`, `CardNotFoundResult`, `ProviderNotFoundError`, and `ProviderUnavailableError` types to `packages/core/src/types/card.ts`
- [x] T004 Re-export all new types from `packages/core/src/types/index.ts` and verify `packages/core/src/index.ts` exports them
- [x] T005 [P] Define `CardProvider` TypeScript type in `apps/server/src/providers/interface.ts` with methods: `lookup`, `checkLegality`, `search`, `isReachable`
- [x] T006 [P] Implement `ProviderRegistry` class in `apps/server/src/providers/registry.ts` with `register`, `getActive`, `setActive` (validates reachability), and `getProviderInfo` methods
- [x] T007 Update `apps/server/index.ts` to initialise `MtgjsonProvider` at startup, register in registry, and call `provider.close()` on graceful shutdown via `fastify.addHook('onClose', ...)`

**Checkpoint**: Core types + provider interface + registry ready — user stories can begin.

---

## Phase 3: User Story 1 — Look Up a Card by Name (Priority: P1) 🎯 MVP

**Goal**: `GET /cards/lookup?name=...` returns all printings of a card with full `CardRecord` data, or a clean "not found" result.

**Independent Test**: `curl "http://localhost:3000/cards/lookup?name=Lightning+Bolt"` returns a 200 with `found: true` and at least one printing containing `name`, `set`, `cardNumber`, and `manaCost`. `curl "http://localhost:3000/cards/lookup?name=ZZZFakeCard"` returns `found: false`.

- [x] T008 [P] [US1] Implement `mapCardSetToCardRecord(card): CardRecord` in `apps/server/src/providers/mtgjson/mapper.ts`
- [x] T009 [US1] Implement `MtgjsonProvider` class in `apps/server/src/providers/mtgjson/index.ts` with `lookup()` using `sdk.cards.getPrintings()` for exact and `sdk.cards.search({ fuzzyName })` for fuzzy
- [x] T010 [US1] Add `lookupCard()` to `apps/server/src/services/cardService.ts`
- [x] T011 [US1] Add `GET /cards/lookup` route to `apps/server/src/routes/cards.ts` with Fastify JSON schema

**Checkpoint**: Card lookup end-to-end functional. Verify with `curl` against a running server.

---

## Phase 4: User Story 2 — Look Up a Card's Legality for Commander (Priority: P2)

**Goal**: `GET /cards/legality?name=...` returns a `LegalityResult` with `legal`, `reason`, and `colorIdentity`.

**Independent Test**: `curl "http://localhost:3000/cards/legality?name=Sol+Ring"` returns `legal: true`. `curl "http://localhost:3000/cards/legality?name=Black+Lotus"` returns `legal: false, reason: "Banned in Commander"`. `curl "http://localhost:3000/cards/legality?name=Counterspell&commander_colors=R,G"` returns `legal: false, reason: "Colour identity conflict"`.

- [x] T012 [US2] Add `checkLegality()` to `MtgjsonProvider` in `apps/server/src/providers/mtgjson/index.ts`
- [x] T013 [US2] Add `checkCommanderLegality()` to `apps/server/src/services/cardService.ts`
- [x] T014 [US2] Add `GET /cards/legality` route to `apps/server/src/routes/cards.ts`

**Checkpoint**: Legality endpoint functional. Verify with the three `curl` examples above.

---

## Phase 5: User Story 3 — Browse and Search the Card Catalogue (Priority: P3)

**Goal**: `GET /cards/search` accepts name/set/colors/cmc filters and returns a paginated `SearchResult`.

**Independent Test**: `curl "http://localhost:3000/cards/search?colors=R&cmc_max=1"` returns a `SearchResult`. `curl "http://localhost:3000/cards/search"` (no filters) returns 400.

- [x] T015 [US3] Add `search()` to `MtgjsonProvider` in `apps/server/src/providers/mtgjson/index.ts`
- [x] T016 [US3] Add `searchCards()` with server-side pagination to `apps/server/src/services/cardService.ts`
- [x] T017 [US3] Add `GET /cards/search` route to `apps/server/src/routes/cards.ts`

**Checkpoint**: Search endpoint functional. Verify pagination with `page=1&limit=5` on a broad query.

---

## Phase 6: User Story 4 — Switch the Active Card Data Provider (Priority: P4)

**Goal**: `GET /provider` returns current provider info. `PUT /provider` validates and switches the active provider.

**Independent Test**: `curl http://localhost:3000/provider` returns `{"name":"mtgjson","active":true,"reachable":true}`. `curl -X PUT -d '{"name":"unknown"}' http://localhost:3000/provider` returns 404.

- [x] T018 [US4] Add `isReachable()` to `MtgjsonProvider` in `apps/server/src/providers/mtgjson/index.ts`
- [x] T019 [US4] Create `apps/server/src/routes/provider.ts` with `GET /provider` and `PUT /provider`
- [x] T020 [US4] Register `providerRoutes` in `apps/server/index.ts`

**Checkpoint**: Provider management endpoints functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling consistency, graceful shutdown, and documentation.

- [x] T021 `PROVIDER_UNAVAILABLE` 503 handled in `cardRoutes` error handler; `CardNotFoundError` → 404; `ProviderUnavailableError` → 503
- [x] T022 Graceful shutdown confirmed: `fastify.addHook('onClose', async () => mtgjsonProvider.close())` in `apps/server/index.ts`
- [x] T023 [P] `pnpm turbo typecheck` passes — 3/3 tasks successful, 0 errors
- [x] T024 [P] Write `apps/server/docs/card-data-provider.md` documenting provider layer, startup flow, `CARD_PROVIDER`/`MTGJSON_CACHE_DIR` env vars, and how to add a new provider
- [ ] T025 Run the quickstart validation scenarios from `specs/004-card-data-provider/quickstart.md` against a locally running server and confirm all pass

---

## Phase 8: US1 Amendment — Set + Number Narrowing (FR-005a, FR-005b)

**Goal**: `GET /cards/lookup` accepts optional `set` and `number` querystring params so callers can narrow to a specific set or a single printing without having to filter client-side.

**Independent Test**:
- `curl "http://localhost:3000/cards/lookup?name=Lightning+Bolt&set=M11"` returns only M11 printings.
- `curl "http://localhost:3000/cards/lookup?name=Lightning+Bolt&set=M11&number=149"` returns exactly one card.
- `curl "http://localhost:3000/cards/lookup?name=Lightning+Bolt&set=ZZZ"` returns `found: false`.

- [x] T026 Update `LOOKUP_QUERYSTRING_SCHEMA` in `packages/core/src/schemas/card.ts` to add optional `set` (string) and `number` (string) properties
- [x] T027 Update `CardProvider` `lookup` signature in `apps/server/src/providers/interface.ts` — change second argument to an options object `opts?: { fuzzy?: boolean; set?: string; number?: string }` so providers can receive all lookup constraints in one call
- [x] T028 Update `MtgjsonProvider.lookup()` in `apps/server/src/providers/mtgjson/index.ts` — when `opts.set` is provided use `sdk.cards.getByName(name, { setCode: opts.set })` for exact-name set-scoped lookup; when `opts.number` is also provided filter results in-process with `results.filter(c => c.number === opts.number)`; fall back to existing fuzzy/exact logic when no set is given
- [x] T029 Update `lookupCard()` in `apps/server/src/services/cardService.ts` — add `set?` and `number?` to its parameter signature and pass them through to the provider
- [x] T030 Update `GET /cards/lookup` route in `apps/server/src/routes/cards.ts` — extend `LookupQuerystring` type and handler to extract `set` and `number` from the querystring and pass them to `lookupCard()`
- [x] T031 Update tests: add set-scoped and number-scoped cases to `cardService.test.ts` and `cards.test.ts`; update `provider/interface.ts`-related tests in `registry.test.ts` if the signature change requires it

**Checkpoint**: All three `curl` examples above return expected results against a running server.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — no dependency on other stories
- **US2 (Phase 4)**: Depends on Phase 2 — no dependency on US1
- **US3 (Phase 5)**: Depends on Phase 2 — no dependency on US1 or US2
- **US4 (Phase 6)**: Depends on Phase 2 (registry)
- **Polish (Phase 7)**: Depends on all desired phases complete

### Within Each User Story

- Mapper (T008) → Provider method → Service method → Route handler

### Parallel Opportunities

- T005 (CardProvider type) and T006 (ProviderRegistry) can run in parallel within Phase 2
- US2 (Phase 4) and US3 (Phase 5) can run in parallel once Phase 2 is complete
- T023 (typecheck) and T024 (docs) can run in parallel in Phase 7

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T007) — **critical blocker**
3. Complete Phase 3: US1 Card Lookup (T008–T011)
4. **STOP and VALIDATE**: `curl "http://localhost:3000/cards/lookup?name=Lightning+Bolt"`
5. Ship if ready

### Incremental Delivery

1. Setup + Foundational → provider infrastructure ready
2. Add US1 (Card Lookup) → test independently → demo
3. Add US2 (Legality) → test independently → demo
4. Add US3 (Search) → test independently → demo
5. Add US4 (Provider Switching) → final validation
6. Polish → typecheck, docs, quickstart

---

## Notes

- `mtgjson-sdk` uses a local DuckDB under the hood — the SDK instance must be a singleton held for the server process lifetime (initialise in `index.ts`, not per-request)
- Pagination is **server-side only**: the SDK returns all search results; the service layer slices by offset + limit
- `manaCost` is `null` for lands — routes allow `null` in their Fastify response schema
- `CARD_PROVIDER` env var defaults to `"mtgjson"` — this is the only registered provider in this release
- `MTGJSON_CACHE_DIR` env var defaults to `./data/mtgjson-cache` — mount as Docker volume for persistence
- The existing `cardService.ts` covers binder CRUD; the new provider methods are additive (no changes to existing functions)
- Do not touch `apps/mobile` — the mobile app calls the server API only (Principle VI)
