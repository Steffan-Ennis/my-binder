---
description: "Tasks for spec 018 — Card Catalogue Search"
---

# Tasks: Card Catalogue Search

**Input**: Design documents from `/specs/018-card-catalogue-search/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: Per Constitution Principle III, **unit tests are REQUIRED** for every
behaviour added by this feature. Every test file is co-located beside the file
under test as `<filename>.test.ts(x)`. Tests MUST be written before implementation
and MUST fail before the corresponding implementation lands.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (`pnpm` + Turborepo). Three workspaces touched:

- `packages/core/src/` — shared types + Ajv schemas
- `apps/server/src/` — Fastify API + TypeORM
- `apps/mobile/` — Expo / React Native app (sources under `apps/mobile/src/`, routes under `apps/mobile/app/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: One new mobile dependency, one Jest mock, one Jest coverage-threshold update.

- [X] T001 Add `@gorhom/bottom-sheet@^5` to `apps/mobile/package.json` via `pnpm --filter @my-binder/mobile add @gorhom/bottom-sheet@^5` (Principle XI — pinned to the registry-current v5 line)
- [X] T002 [P] Add the `@gorhom/bottom-sheet` default mock to `apps/mobile/jest.setup.ts` per plan.md "Mobile mocking conventions" (typed `forwardRef` `BottomSheetModal` with `present`/`dismiss`; default-exported + named exports for `BottomSheetModalProvider`, `BottomSheetBackdrop`, `BottomSheetScrollView`)
- [X] T003 [P] Extend `coverageThreshold` in `apps/mobile/jest.config.ts` to cover the four new feature directories (`components/masthead/**` 90%, `components/catalogue/**` 85%, `components/catalogue-filter-sheet/**` 85%, `components/card-detail-sheet/**` 85%) and `hooks/useUpdateBinderEntryMutation.ts` at 90% per plan.md "Coverage target"

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, Ajv schemas, the additive Postgres column, the
`CardProvider` interface extension, the shared `<Masthead />` component, and the
mobile `apiClient` extensions that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### `@my-binder/core` — types, schemas, and their tests

- [X] T004 [P] Write Ajv schema tests in `packages/core/src/schemas/card.test.ts` for the eight new/extended schemas (`CARD_RESPONSE_SCHEMA` accepts `numberOwned: integer ≥ 0`; `CARD_RECORD_SCHEMA` accepts `numberOwned`; `SEARCH_QUERYSTRING_SCHEMA` accepts each new field; `PRICE_QUOTE_SCHEMA` accepts `null` OR a quote object; `CARD_PRICES_RESPONSE_SCHEMA` requires both source slots; `CARD_PRICE_HISTORY_RESPONSE_SCHEMA` validates per-source arrays; `PATCH_CARD_BODY_SCHEMA` rejects `delta` values other than `1` or `-1`). Tests MUST fail before T005–T007 land.
- [X] T005 [P] Extend `packages/core/src/types/card.ts` with `numberOwned?` on `CardRecord`, the five catalogue filter fields (`formats`, `superTypes`, `subTypes`, `creatureTypes`, `missingOnly`) plus internal `userId` on `SearchQuery`, and the new `PRICE_SOURCES` const + `PriceSource`, `PriceQuote`, `CardPricesResponse`, `PricePoint`, `CardPriceHistoryResponse` types per data-model §1.3, §1.4, §2.3, §2.4.
- [X] T006 [P] Extend `packages/core/src/types/crud.ts` with optional `numberOwned?: number` on `Card`, and add the new `PatchCardBody` type (`{ delta: 1 | -1 }`) per data-model §1.2, §2.5.
- [X] T007 Extend `packages/core/src/schemas/card.ts`: add `numberOwned` to `CARD_RESPONSE_SCHEMA` and `CARD_RECORD_SCHEMA`; add `formats`, `super_types`, `sub_types`, `creature_types`, `missing_only` to `SEARCH_QUERYSTRING_SCHEMA`; add `PRICE_QUOTE_SCHEMA`, `CARD_PRICES_RESPONSE_SCHEMA`, `PRICE_POINT_SCHEMA`, `CARD_PRICE_HISTORY_RESPONSE_SCHEMA`, `PATCH_CARD_BODY_SCHEMA` per data-model §2.4, §2.5 (makes T004 pass).

### Server — entity, migration, provider interface

- [X] T008 [P] Add `@Column({ name: 'number_owned', type: 'integer', default: 1 }) numberOwned!: number` to `apps/server/src/entities/CardEntity.ts` per data-model §1.1.
- [X] T009 Generate a new TypeORM migration at `apps/server/src/db/migrations/<ts>-add-number-owned.ts` that runs `ALTER TABLE "cards" ADD COLUMN "number_owned" integer NOT NULL DEFAULT 1 CHECK ("number_owned" >= 1)` and reverses with `DROP COLUMN`. Verify locally with `pnpm --filter @my-binder/server migration:run`.
- [X] T010 [P] Extend the `CardProvider` interface in `apps/server/src/providers/interface.ts` with two new method signatures: `getPrices(uuid: string): Promise<CardPricesResponse>` and `getPriceHistory(uuid: string, days: number): Promise<CardPriceHistoryResponse>` per data-model §2.1 (imports the wire types from `@my-binder/core`).

### Mobile — shared `<Masthead />` component (Principle IV; FR-002)

- [X] T011 [P] Create `apps/mobile/src/components/masthead/types.ts` exporting `MastheadProps` per data-model §5 / contracts/ui.md §2.1.
- [X] T012 [P] Write `apps/mobile/src/components/masthead/Masthead.test.tsx` covering the full render contract from contracts/ui.md §2.2 + accessibility labels from §2.3: renders subtitle / overline / binder mark / search + profile buttons when `isSearchActive=false`; renders inline `TextInput` + close button when `isSearchActive=true`; fires `onSearchOpen`, `onProfilePress`, `onSearchClose`, `onSearchChange` from the corresponding controls; renders the `filterPills` slot when provided; renders the gold-dot active-query indicator when `hasActiveQuery=true`. Use `<MastheadWithDefaults>` per the v1.24.0 rule.
- [X] T013 Implement `apps/mobile/src/components/masthead/Masthead.tsx` and `apps/mobile/src/components/masthead/Masthead.theme.ts` (pure presentation component — no hook layer; FC declaration rule; style co-location rule) so T012 passes.

### Mobile — apiClient extensions

- [X] T014 [P] Extend `apps/mobile/src/services/api/apiClient.test.ts` with coverage for the six new client methods (`searchCards(query)` serialises filter arrays as comma-separated strings; `getCardPrices(id)` parses `CardPricesResponse`; `getCardPriceHistory(id, days)` parses `CardPriceHistoryResponse`; `getCard(id)` throws `ApiError('NOT_FOUND')` on 404; `upsertCard({id,name})` calls `POST /cards`; `patchCard(id, {delta})` returns `{status:200, card} | {status:204}`).
- [X] T015 Extend `apps/mobile/src/services/api/apiClient.ts` with `searchCards`, `getCardPrices`, `getCardPriceHistory`, `getCard`, `upsertCard`, `patchCard`, each validating responses against the Ajv schemas re-exported from `@my-binder/core`.

**Checkpoint**: Foundation ready — user story implementation can now begin.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test --filter=@my-binder/core --filter=@my-binder/server --filter=@my-binder/mobile`
> and the matching `turbo typecheck` invocation. **Both MUST exit 0 and Jest
> MUST report a 100% pass rate.** Investigate every failure at root cause —
> `.skip` / `.todo` / quarantine / retry-until-green are prohibited.

---

## Phase 3: User Story 1 - Browse the Card Catalogue in 9-Pocket Pages (Priority: P1) 🎯 MVP

**Goal**: Replace the `<ComingSoonContainer />` stub on the Search tab with a
fully-rendered catalogue: shared crimson masthead, paper-cream canvas, 3×3
pocket grid, swipe-only paging, lazy `useInfiniteQuery` page loading, in-cache
backward navigation, "N of many"/"N of M" italic indicator (no flanking arrows).

**Independent Test**: Sign in, tap the Catalogue tab, confirm the crimson
header reads "Catalogue", the 3×3 grid renders 9 front faces, swipe left loads
the next 9 cards with the indicator incrementing, swipe right serves the prior
page from cache without refetching.

### Tests for User Story 1 (Jest unit tests REQUIRED) ⚠️

> Write these tests FIRST, ensure they FAIL before implementation (Principle III).

- [X] T016 [P] [US1] Tests — Extend `apps/server/src/providers/mtgjson/MtgjsonProvider.test.ts`: `search({formats})` forwards to `sdk.cards.search({legalities: …})`; `search({superTypes})` forwards to `{supertypes: …}`; `search({subTypes})` forwards to `{subtypes: …}`; `search({creatureTypes})` filters creature subtypes; **every** `search` response excludes `availability.includes('paper') === false` (FR-021 / SC-007).
- [X] T018 [P] [US1] Tests — Extend `apps/server/src/repositories/cardRepository.test.ts`: `findAll` selects and returns the new `number_owned` column on every row, defaulting to 1 for rows inserted before this migration.
- [X] T020 [P] [US1] Tests — Extend `apps/server/src/services/cardService.test.ts`: `searchCards({formats:['Modern']})` excludes printings not legal in Modern; `searchCards({superTypes:['Legendary']})` filters; `searchCards({creatureTypes:['Elf']})` filters non-Elf creatures; every response item carries `numberOwned` when `userId` is provided and OMITS it when not; digital-only printings are absent from every response.
- [X] T022 [P] [US1] Tests — Extend `apps/server/src/routes/cards.test.ts`: `GET /cards/search?formats=Modern` returns 200 and only Modern-legal printings; `GET /cards/search?super_types=Legendary&creature_types=Elf` AND-combines dimensions; an authenticated `GET /cards/search?name=bolt` returns `cards[].numberOwned` on every row; an unauthenticated call omits `numberOwned`.
- [X] T024 [P] [US1] Tests — `apps/mobile/src/hooks/useCatalogueInfiniteQuery.test.ts`: returns the flat list of validated `CardRecord` across pages; `getNextPageParam` returns `undefined` when `page === totalPages`; `queryKey` includes the serialised filters; `enabled` gates on `useSession().status === 'active'`; `staleTime`/`gcTime` honoured per research.md §2.
- [X] T027 [P] [US1] Tests — `apps/mobile/src/components/catalogue/useCatalogue.test.ts` (US1 subset): returns memoised `pages`, `currentPage`, `totalPages`, `summaryCaption`, `onPagerSelected`; `summaryCaption` reads `"N+ MATCHES · 9 PER PAGE"` while `hasNextPage=true` and `"N MATCHES · M PAGES"` once exhausted; `onPagerSelected(n)` advances `currentPage`; non-primitive return values are reference-stable across renders (Principle X v1.16.0).
- [X] T029 [P] [US1] Tests — `apps/mobile/src/components/catalogue/CatalogueView.test.tsx` (US1 subset): renders `<Masthead subtitle="Catalogue" />`, the summary caption, the binder page surface, the 3×3 pocket grid, and the italic "N of many"/"N of M" indicator; renders `catalogue-skeleton-pocket` rows while `isLoading`; populated pockets render `<Card />`; **no** flanking arrow buttons are rendered (FR-010 / 2026-05-17 Clarification). Use `<CatalogueViewWithDefaults>` per the v1.24.0 rule.
- [X] T031 [P] [US1] Tests — `apps/mobile/src/components/catalogue/CatalogueContainer.test.tsx`: wires `useCatalogue` to `<CatalogueView />` with named props (no spread) per the Container prop-passing rule.

### Implementation for User Story 1

- [X] T017 [US1] Implement the search extension in `apps/server/src/providers/mtgjson/MtgjsonProvider.ts`: forward `formats` → `legalities`, `superTypes` → `supertypes`, `subTypes` → `subtypes`, `creatureTypes` → subtype-filtering, and apply `card.availability.includes('paper')` post-filter before returning. Makes T016 pass.
- [X] T019 [US1] Modify `apps/server/src/repositories/cardRepository.ts` `findAll` to project `number_owned` on every row and map to `numberOwned` on the response shape. Makes T018 pass.
- [X] T021 [US1] Modify `apps/server/src/services/cardService.ts` `searchCards` to (a) accept the five new filter dimensions, (b) accept the optional `userId`, (c) `LEFT JOIN cards ON cards.id = printing.uuid AND cards.user_id = :userId` and project `COALESCE(cards.number_owned, 0)` as `numberOwned` per record (only when `userId` is set), (d) post-filter `missingOnly` (deferred behaviour: drop rows whose `numberOwned > 0`) — gating behaviour only; the wire dimension is exposed but the catalogue UI activates it in US2. Makes T020 pass.
- [X] T023 [US1] Modify `apps/server/src/routes/cards.ts`: in the `GET /cards/search` handler, parse each comma-separated list into `string[]` (trimming whitespace, discarding empty tokens), populate `query.userId` from `request.identity` when present, drop the `MISSING_FILTER` 400 short-circuit when any of the new dimensions is set, and return 401 `AUTH_INVALID_TOKEN` only when `missing_only=true` is set without a Bearer JWT. Makes T022 pass.
- [X] T025 [US1] Implement `apps/mobile/src/hooks/useCatalogueInfiniteQuery.ts` (TanStack `useInfiniteQuery` against `apiClient.searchCards`; `initialPageParam=1`; page size `SLOTS_PER_BINDER_PAGE`; staleTime 60s; gcTime 300s; named `UseCatalogueInfiniteQueryResult` type alias exported). Makes T024 pass.
- [X] T026 [P] [US1] Create `apps/mobile/src/components/catalogue/types.ts` exporting `CatalogueFilterSet`, `EMPTY_FILTER_SET`, `CataloguePage`, `CatalogueViewProps`, `UseCatalogueOptions` per data-model §3.1, §3.2, §3.3 (Principle X v1.26.0 sub-rule #7 — feature-local types file).
- [X] T028 [US1] Implement `apps/mobile/src/components/catalogue/useCatalogue.ts` (US1 subset only — compose `useCatalogueInfiniteQuery` with `EMPTY_FILTER_SET`; expose `pages`, `currentPage`, `totalPages`, `summaryCaption`, `hasNextPage`, `onPagerSelected`, masthead props, `onProfilePress` via `useRouter()`. All non-primitive return values memoised per Principle X v1.16.0). Filter sheet, mutations, and detail-sheet wiring land in later phases. Makes T027 pass.
- [X] T030 [US1] Implement `apps/mobile/src/components/catalogue/CatalogueView.tsx` and `apps/mobile/src/components/catalogue/CatalogueView.theme.ts` per contracts/ui.md §3.3 (masthead + binder page surface + 3×3 grid + italic indicator + skeleton pockets; **no** flanking arrow buttons). Pockets render `<Card id={…} footprint="pocket" />` from spec 017 — no add/remove glyphs yet. Makes T029 pass.
- [X] T032 [US1] Implement `apps/mobile/src/components/catalogue/CatalogueContainer.tsx` (named-props bridge from hook to view). Makes T031 pass.
- [X] T033 [US1] Update Expo Router files: `apps/mobile/app/(authenticated)/(tabs)/search.tsx` renders `<CatalogueContainer />`; `apps/mobile/app/(authenticated)/(tabs)/_layout.tsx` sets `headerShown: false` on the Search `<Tabs.Screen />` so the masthead renders edge-to-edge (contracts/ui.md §1.1, §1.2).

**Checkpoint**: User Story 1 fully functional and testable independently.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test` and `turbo typecheck` across `@my-binder/core`,
> `@my-binder/server`, `@my-binder/mobile`. **Both MUST exit 0 and Jest MUST
> report a 100% pass rate.** Investigate every failure at root cause.

---

## Phase 4: User Story 2 - Filter the Catalogue by Card Attributes (Priority: P1)

**Goal**: Surface filter controls (search input on the masthead + a
bottom-sheet filter UI with chips for set, format, super type, sub type,
creature type, CMC range, colour identity, and the `Missing only` toggle).
Filters AND across dimensions, OR within. Active filters are visible at all
times; clearing restores the unfiltered browse from page 1.

**Independent Test**: Open the Catalogue, tap the masthead search button, type
`bolt`. Open Filters; pick `Format: Modern` and `Colour: R`. Apply. Confirm
the grid re-flows to the AND-intersection, the filter-pill row in the masthead
slot shows three pills (one ⌅ Filters opener + two value pills), and tapping
the `×` on a pill drops just that dimension.

### Tests for User Story 2 (Jest unit tests REQUIRED) ⚠️

- [ ] T034 [P] [US2] Tests — `apps/mobile/src/components/catalogue-filter-sheet/useCatalogueFilterSheet.test.ts`: holds a `draft` initialised from the `committed` prop; `toggleChip(dimension, value)` mutates only the draft; `onApply()` invokes the consumer's `onApply(draft)`; `onClear()` resets the draft to `EMPTY_FILTER_SET` (does NOT propagate to the consumer's `onClear`); `onClose()` discards the draft.
- [ ] T036 [P] [US2] Tests — `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetView.test.tsx`: renders the `Missing only` iOS-style toggle, every dimension's chip row (Set, Format, Super type, Sub type, Creature type), CMC min/max numeric inputs, six colour chips (W/U/B/R/G/C), and the "Clear all" + "Apply" footer buttons; selected chips render with the `selected` style and selected colour chips render the gold ring; tapping "Clear all" fires `onClearAll`; tapping "Apply" fires `onApply(draft)`; tapping the close `×` fires `onClose`.

### Implementation for User Story 2

- [ ] T035 [P] [US2] Create `apps/mobile/src/components/catalogue-filter-sheet/types.ts` exporting `UseCatalogueFilterSheetOptions` and the view-props type per contracts/ui.md §4.1.
- [ ] T037 [US2] Implement `apps/mobile/src/components/catalogue-filter-sheet/useCatalogueFilterSheet.ts` (working-draft reducer; stable callbacks per Principle X v1.16.0). Makes T034 pass.
- [ ] T038 [US2] Implement `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetView.tsx` and `CatalogueFilterSheetView.theme.ts` mirroring the wireframe's `#filterSheet` (uses `BottomSheetModal` from `@gorhom/bottom-sheet`; snap points `['78%']`; close + scrim + swipe-down dismiss). Makes T036 pass.
- [ ] T039 [US2] Implement `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetContainer.tsx` (wires hook → view).
- [ ] T040 [US2] Extend `apps/mobile/src/components/catalogue/useCatalogue.ts`: feature-local filter reducer initialised from `EMPTY_FILTER_SET`; masthead `isSearchActive`/`searchQuery` state; debounced commit of the search input into `filters.name`; derived `filterPills` array; callbacks `onSearchOpen`, `onSearchChange`, `onSearchClose`, `onFilterSheetOpen`, `onFilterSheetClose`, `onFilterPillRemove`, `onFilterClear`, `onFilterApply` (each memoised). All Principle X v1.26.0 rules honoured.
- [ ] T041 [US2] Extend `apps/mobile/src/components/catalogue/CatalogueView.tsx`: wire `<Masthead />` with `subtitle="Catalogue"`, `isSearchActive`, `searchQuery`, `filterPills` slot (renders the chip row + the ⌅ Filters opener), mount the `CatalogueFilterSheetContainer`, and render the `catalogue-empty-state` pane ("no cards match these filters" + "clear filters" affordance) when `pages[0]?.cards.length === 0`. The italic indicator now reads `"N of many"` while `hasNextPage=true` and `"N of M"` once exhausted.
- [ ] T042 [US2] Extend `apps/mobile/src/components/catalogue/useCatalogue.test.ts` and `CatalogueView.test.tsx`: `onFilterPillRemove(id)` drops one dimension and refetches; `onFilterClear()` resets to `EMPTY_FILTER_SET`; the zero-match empty state renders the panel + clear-all affordance (FR-015); the indicator switches between `"N of many"` and `"N of M"` correctly (FR-013); the `Missing only` toggle requires authentication and disables when unauthenticated.

**Checkpoint**: User Story 2 functional alongside User Story 1.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test` and `turbo typecheck` across the three workspaces. Both MUST
> exit 0 with a 100% Jest pass rate.

---

## Phase 5: User Story 4 - Add Cards From Catalogue, Remove From Binder (Priority: P1)

**Goal**: Inline `+` glyph-button on every Catalogue pocket and inline `−`
glyph-button on every Binder pocket. Both surfaces render the `×N`
owned-count glyph driven by `numberOwned`. Mutations are optimistic
(SC-011 / SC-012). Adopting the shared `<Masthead />` on the Binder
(FR-022) lands as part of this story. The `Missing only` defer-and-refresh
affordance (FR-031) is wired in.

**Independent Test**: Sign in with an empty binder, open Catalogue, tap `+`
on any pocket and confirm the `×1` glyph appears and the Binder now contains
that card. Tap `+` again on the same pocket → `×2`. Switch to the Binder,
tap `−` on the pocket twice → on the second tap the pocket disappears, the
binder grid reflows, the summary caption and page count recompute. Turn on
`Missing only` in the Catalogue, tap `+` on a pocket and confirm the pocket
**stays put** while the gold-bordered "results out-of-date" banner appears;
tap the banner → the pocket disappears.

### Tests for User Story 4 (Jest unit tests REQUIRED) ⚠️

- [ ] T043 [P] [US4] Tests — Extend `apps/server/src/repositories/cardRepository.test.ts`: `upsertIncrement` creates a fresh row at `numberOwned=1`; `upsertIncrement` on a duplicate `(id, user_id)` increments by 1; `adjustNumberOwned(delta:+1)` increments; `adjustNumberOwned(delta:-1)` at count > 1 decrements; `adjustNumberOwned(delta:-1)` at count = 1 deletes the row inside the same transaction and returns null; `adjustNumberOwned` against a non-row returns 404 / null sentinel.
- [ ] T045 [P] [US4] Tests — Extend `apps/server/src/routes/cards.test.ts`: `POST /cards` first insert returns 201 with `numberOwned=1`; `POST /cards` duplicate returns 200 with incremented `numberOwned` (NOT 409); `PATCH /cards/:id { delta: +1 }` returns 200; `PATCH /cards/:id { delta: -1 }` at `numberOwned=2` returns 200 with count=1; `PATCH /cards/:id { delta: -1 }` at `numberOwned=1` returns 204 with no body; `PATCH /cards/:id { delta: -1 }` against a non-row returns 404; `PATCH /cards/:id { delta: 0 }` returns 400 `VALIDATION_ERROR`.
- [ ] T047 [P] [US4] Tests — `apps/mobile/src/hooks/useUpdateBinderEntryMutation.test.tsx`: `onMutate({delta:+1})` optimistically increments `numberOwned` in `['cards','list']` AND in every `['catalogue','search', …]` cache; `onMutate({delta:-1})` at `numberOwned=1` removes the row from `['cards','list']` and zeroes the catalogue cache row; `onError` rolls back both caches to the snapshot; `onSettled` invalidates `['cards','list']` but does NOT invalidate the catalogue caches (FR-031); `onSettled` publishes the `binderMutationLanded` signal that `useCatalogue` subscribes to.
- [ ] T052 [P] [US4] Tests — Update `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`: `<Masthead />` is rendered as a child component (the inline header bar is removed); each populated pocket renders a `−` glyph-button; tapping the `−` glyph fires `onPocketRemove(id)`; the owned-count `×N` glyph is visible iff `numberOwned >= 2` (FR-024); existing SC-006 assertions (`pocket-occupied`, `pocket-empty`, `binder-page-ring`) remain green.
- [ ] T053 [P] [US4] Tests — Update `apps/mobile/src/components/binder-home/useBinderHome.test.ts`: exposes `mastheadProps` derived from existing state; `onPocketRemove(id)` invokes `useUpdateBinderEntryMutation` with `{delta:-1}`; the binder grid recomputes `totalPages` and summary caption when a row is removed (FR-026).

### Implementation for User Story 4

- [ ] T044 [US4] Implement `upsertIncrement(id, name, userId)` and `adjustNumberOwned(id, userId, delta)` in `apps/server/src/repositories/cardRepository.ts` using `INSERT … ON CONFLICT (id, user_id) DO UPDATE SET number_owned = cards.number_owned + 1, updated_at = NOW() RETURNING *` and `UPDATE … SET number_owned = number_owned + :delta, updated_at = NOW() WHERE id = :id AND user_id = :userId RETURNING *` (inside a TypeORM transaction; the helper issues `DELETE` when the returned `number_owned = 0`). Makes T043 pass.
- [ ] T046 [US4] Modify `apps/server/src/routes/cards.ts`: rewire `POST /cards` to call `upsertIncrement` (201 on fresh, 200 on duplicate); add the new `PATCH /cards/:id` handler validating body against `PATCH_CARD_BODY_SCHEMA` and params against `CARD_ID_PARAMS_SCHEMA`; on `delta:-1` against a non-row, return 404; on row deletion, return 204; otherwise return 200 with the updated card. Makes T045 pass.
- [ ] T048 [US4] Implement `apps/mobile/src/hooks/useUpdateBinderEntryMutation.ts`: `useMutation` over `apiClient.upsertCard` (when adding) and `apiClient.patchCard` (when incrementing or decrementing); `onMutate` snapshots and optimistically updates both cache spaces; `onError` restores; `onSettled` invalidates `['cards','list']` and publishes the internal `binderMutationLanded` event (in-memory `EventTarget`/pub-sub). Exports `useBinderMutationLandedSignal()` for consumers. Makes T047 pass.
- [ ] T049 [US4] Extend `apps/mobile/src/components/catalogue/useCatalogue.ts` (continuing the file shaped in T028/T040): consume `useUpdateBinderEntryMutation`; add `onPocketAddPress(id)` that calls the mutation with `{delta:+1}`; add `resultsAreStale` flag set to `true` when the `binderMutationLanded` signal fires AND any filter dimension is active (FR-031); add `onRefreshPress` that invalidates `['catalogue','search',…]` and clears the stale flag. All callbacks memoised per Principle X v1.16.0.
- [ ] T050 [US4] Extend `apps/mobile/src/components/catalogue/CatalogueView.tsx`: overlay a `catalogue-pocket-action-add` `+` glyph-button on every populated pocket (bottom-right, `hitSlop:8`, `pointerEvents:'box-only'` per FR-027 / SC-013); overlay a `catalogue-owned-glyph` `×N` glyph in the top-right when `card.numberOwned >= 1`; render the `catalogue-refresh-hint` gold-bordered banner inside the canvas when `resultsAreStale === true` (FR-031).
- [ ] T051 [US4] Extend `apps/mobile/src/components/catalogue/useCatalogue.test.ts` + `CatalogueView.test.tsx`: tapping `+` on a pocket invokes the mutation with `{delta:+1}` and does NOT navigate; the owned-count glyph appears in the optimistic frame; the refresh banner appears after a mutation while a filter is active and disappears after `onRefreshPress`; mutating without an active filter does not set the stale flag.
- [ ] T054 [US4] Refactor `apps/mobile/src/components/binder-home/BinderHomeView.tsx`: delete the inline header (lines 82–151 in the current file) and render `<Masthead {...mastheadProps} />`; add the `−` glyph-button overlay (`catalogue-pocket-action-add`-style, mirrored to `binder-pocket-action-remove`) and the `×N` owned-count glyph visible when `numberOwned >= 2` (FR-024). Makes T052 pass.
- [ ] T055 [US4] Refactor `apps/mobile/src/components/binder-home/useBinderHome.ts`: derive a `mastheadProps` object from the existing search/profile state and expose it on the return; consume `useUpdateBinderEntryMutation` and expose `onPocketRemove(id)` that calls it with `{delta:-1}`; ensure derived `totalPages` and `summaryCaption` recompute when the binder cache changes. Makes T053 pass.

**Checkpoint**: User Stories 1, 2, AND 4 all work independently and together.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test` and `turbo typecheck` across `@my-binder/core`,
> `@my-binder/server`, `@my-binder/mobile`. Both MUST exit 0 with a 100% Jest
> pass rate. Specifically re-verify spec 016 binder behaviours (in-binder
> search, Profile shortcut) have not regressed (FR-022 / SC-008).

---

## Phase 6: User Story 3 - Inspect a Card's Prices and 30-Day Trend (Priority: P2)

**Goal**: Tapping a populated pocket on either surface (Catalogue or Binder)
opens the shared bottom sheet showing the card's identity, the `−ㅤNㅤ+`
stepper, two labelled price rows (Card Kingdom + TCG Player), and a 30-day
two-line price-trend chart. Missing observations render as `—` and gaps. The
sheet dismisses via swipe-down past threshold or the close control and
restores the underlying page/scroll position. Price data is served live by
the MTGJSON SDK via two new methods on the `CardProvider` abstraction — no
new entity, no migration. MTG Goldfish is deferred to a follow-up specification.

**Independent Test**: Open the Catalogue, tap any populated pocket. Confirm
the sheet renders the card hero, the stepper showing the user's current count
(0 for unowned), the two price rows (each either a `$x.xx` value or `—`), and
the 30-day chart with up to two lines and a legend. Tap `+` on the stepper —
the count increments and the pocket glyph updates. Swipe the sheet down past
threshold — it dismisses and the catalogue page is unchanged.

### Tests for User Story 3 (Jest unit tests REQUIRED) ⚠️

- [ ] T056 [P] [US3] Tests — Extend `apps/server/src/providers/mtgjson/MtgjsonProvider.test.ts`: `getPrices(uuid)` fans out two `sdk.prices.today` calls (provider keys `cardkingdom` and `tcgplayer`, `finish='normal'`, `priceType='retail'`) and returns `{printingId, cardKingdom, tcgPlayer}`; returns `null` per slot when the SDK reports no observation; `getPriceHistory(uuid, 30)` fans out two `sdk.prices.history` calls with `dateFrom = today - 30 days`; returns an empty array per slot when no observations are in the window; the provider-key map contains exactly `CARD_KINGDOM → cardkingdom` and `TCG_PLAYER → tcgplayer` (MTG Goldfish deferred per spec's 2026-05-18 Clarifications entry).
- [ ] T058 [P] [US3] Tests — `apps/server/src/services/priceService.test.ts`: `getCardPrices` delegates to `provider.getPrices` and re-throws as `ProviderUnavailableError`; `getCardPriceHistory` delegates to `provider.getPriceHistory` with `days=30` as the default; both return the provider response unchanged on success.
- [ ] T060 [P] [US3] Tests — `apps/server/src/routes/prices.test.ts`: `GET /cards/:id/prices` against an unknown UUID returns 404 `CARD_NOT_FOUND`; against a valid printing with no observations returns 200 with both slots `null` (FR-019); against a printing MTGJSON has prices for returns the latest observation per source; `GET /cards/:id/prices/history?days=30` returns the per-source arrays; default `days=30` when omitted; both endpoints require authentication.
- [ ] T062 [P] [US3] Tests — `apps/mobile/src/hooks/useCardPricesQuery.test.ts`: returns `null` per slot for printings with no observations; returns populated quotes for seeded printings; `enabled` gates on non-null `id`.
- [ ] T064 [P] [US3] Tests — `apps/mobile/src/hooks/useCardPriceHistoryQuery.test.ts`: returns per-source arrays; default window `days=30`; `enabled` gates on non-null `id`.
- [ ] T066 [P] [US3] Tests — `apps/mobile/src/hooks/useCardDetailsQuery.test.ts`: returns the validated `Card` for a known id; throws `ApiError('NOT_FOUND')` on 404; `enabled` gates on non-null `id`.
- [ ] T069 [P] [US3] Tests — `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.test.ts`: returns `name`, `setCode`, `setName`, `typeLine`, `oracleText`, `artUrl` derived from the composed queries; returns `numberOwned` from the cache; `canDecrement` is false when `numberOwned === 0`; `onIncrement`/`onDecrement` call `useUpdateBinderEntryMutation` with `{delta:+1}` and `{delta:-1}`; `cardKingdomPrice.displayValue` is the formatted dollar amount when present and `"—"` when the slot is `null` (FR-019); `priceHistory` passed through unchanged.
- [ ] T071 [P] [US3] Tests — `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.test.tsx`: renders one SVG `<Path>` per non-empty series (max 2); renders the legend with one entry per visible source; renders only the axes + "no recent price data" annotation when every series is empty (FR-019); y-axis range is computed as `min*0.95` to `max*1.05`.
- [ ] T073 [P] [US3] Tests — `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.test.tsx`: renders the hero (name, set, type, oracle); renders the stepper with the current `numberOwned` and `−`/`+` controls; `−` is visibly disabled when `canDecrement=false` (FR-028); renders both price rows (formatted value OR `—`); renders the chart (two lines OR the empty annotation); tapping the close `×` fires `onClose` (FR-020).

### Implementation for User Story 3

- [ ] T057 [US3] Implement `getPrices` and `getPriceHistory` on `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` per data-model §2.2: define `PROVIDER_KEYS: Record<PriceSource, string>` (`CARD_KINGDOM:'cardkingdom'`, `TCG_PLAYER:'tcgplayer'`); fan out two `sdk.prices.today` (or `.history`) calls with `Promise.all`; map SDK row shapes via `mapTodayToQuote`/`mapHistoryToPoints`; return `null` per slot when no observation. Makes T056 pass.
- [ ] T059 [US3] Implement `apps/server/src/services/priceService.ts`: thin wrapper over `provider.getPrices(uuid)` and `provider.getPriceHistory(uuid, days)` with `ProviderUnavailableError` rewriting per research.md §7. JSDoc + `@example` per Principle IX. Makes T058 pass.
- [ ] T061 [US3] Implement `apps/server/src/routes/prices.ts`: `GET /cards/:id/prices` and `GET /cards/:id/prices/history` route handlers; validate params/query against the Ajv schemas; delegate to `priceService`; map `CARD_NOT_FOUND` to 404 and `ProviderUnavailableError` to 503. Register the file in `apps/server/src/app.ts`. Makes T060 pass.
- [ ] T063 [US3] Implement `apps/mobile/src/hooks/useCardPricesQuery.ts` (TanStack `useQuery` over `apiClient.getCardPrices`; `staleTime: 60_000`; `enabled: id != null`). Makes T062 pass.
- [ ] T065 [US3] Implement `apps/mobile/src/hooks/useCardPriceHistoryQuery.ts` (TanStack `useQuery` over `apiClient.getCardPriceHistory`; default `days=30`; `staleTime: 5 * 60_000`). Makes T064 pass.
- [ ] T067 [US3] Implement `apps/mobile/src/hooks/useCardDetailsQuery.ts` (TanStack `useQuery` over `apiClient.getCard`; `staleTime: 60_000`; `enabled: id != null`). Makes T066 pass.
- [ ] T068 [P] [US3] Create `apps/mobile/src/components/card-detail-sheet/types.ts` exporting `UseCardDetailSheetOptions`, `CardDetailViewProps`, `PriceQuoteDisplay` per data-model §4 / contracts/ui.md §5.1.
- [ ] T070 [US3] Implement `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.ts`: compose `useCardImagesQuery` (existing) + `useCardPricesQuery` + `useCardPriceHistoryQuery` + `useCardDetailsQuery` + `useUpdateBinderEntryMutation`; derive `PriceQuoteDisplay` values formatted as `$x.xx` or `—`; expose `numberOwned`, `canDecrement`, `onIncrement`, `onDecrement`, `onClose`. All Principle X v1.26.0 rules honoured. Makes T069 pass.
- [ ] T072 [US3] Implement `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.tsx` and `PriceTrendChart.theme.ts` using `react-native-svg` direct path drawing per research.md §6: axes via `<Line />`, one `<Path />` per non-empty series, legend via `<Text />` + swatches, "no recent price data" annotation when both series are empty. Makes T071 pass.
- [ ] T074 [US3] Implement `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.tsx` and `CardDetailSheetView.theme.ts` per contracts/ui.md §5.2 (hero + stepper + prices section + chart, wrapped in `BottomSheetModal` with snap points `['80%']`, swipe-down past 30% dismisses). Makes T073 pass.
- [ ] T075 [US3] Implement `apps/mobile/src/components/card-detail-sheet/CardDetailSheetContainer.tsx` (named-props bridge from hook to view).
- [ ] T076 [US3] Wire the sheet into the catalogue: extend `apps/mobile/src/components/catalogue/useCatalogue.ts` with `detailPrintingId` state (set by `onPocketPress`, cleared by `onDetailSheetClose`); render `<CardDetailSheetContainer printingId={detailPrintingId} surface="catalogue" onClose={onDetailSheetClose} />` inside `CatalogueView.tsx`. Update `useCatalogue.test.ts` and `CatalogueView.test.tsx` to cover the open/close lifecycle and the requirement that closing the sheet preserves `currentPage` (FR-020).
- [ ] T077 [US3] Wire the sheet into the binder: extend `apps/mobile/src/components/binder-home/useBinderHome.ts` and `BinderHomeView.tsx` to open the same `<CardDetailSheetContainer surface="binder" />` on pocket press; update the matching `useBinderHome.test.ts` and `BinderHomeView.test.tsx` for the same lifecycle assertions on the binder surface.

**Checkpoint**: All user stories independently functional.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test` and `turbo typecheck` across **every** workspace touched by
> US1+US2+US3+US4. Both MUST exit 0 with a 100% Jest pass rate. Investigate
> every failure at root cause.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Manual acceptance walk-through, full repository validation, and a
final sweep over the new code for constitution compliance.

- [ ] T078 [P] Run the manual acceptance walkthrough in `specs/018-card-catalogue-search/quickstart.md` §3.1–§3.5 on a simulator (Catalogue browse, filter, detail sheet, add/remove, defer-and-refresh) and tick every box in §5.
- [ ] T079 [P] Run `turbo test` and `turbo typecheck` across all three touched workspaces (`@my-binder/core`, `@my-binder/server`, `@my-binder/mobile`); both MUST exit 0 with a 100% Jest pass rate, with coverage thresholds from T003 honoured.
- [ ] T080 Constitution sweep on every file touched by this feature: FC declaration rule (`const X: FC<…> = …`), style co-location (`<Component>.theme.ts` sibling), hook return-value memoisation (v1.16.0), data-fetching hook composition (v1.26.0), state locality (no new Zustand store), Principle IX (every new public function on `cardRepository`, `priceService`, `MtgjsonProvider` has JSDoc with `@example`).
- [ ] T081 Verify `apps/mobile/package.json` lists `@gorhom/bottom-sheet` at the registry-current `^5` (Principle XI Dependency Currency Check).
- [ ] T082 Confirm no `.skip` / `xit` / `describe.skip` / `it.todo` exist in any test file added or modified by this feature (Principle III gate).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3, P1)**: Depends on Foundational completion
- **User Story 2 (Phase 4, P1)**: Depends on Foundational; lightly extends US1's `useCatalogue` + `CatalogueView` files but adds the filter sheet as a fresh feature directory. Can begin in parallel with US4 once US1 has landed.
- **User Story 4 (Phase 5, P1)**: Depends on Foundational; extends US1's `useCatalogue` + `CatalogueView`; ships the cross-feature mutation hook and the Binder refactor. Server-side it adds endpoints that US3 does NOT depend on. Can begin in parallel with US2 once US1 has landed.
- **User Story 3 (Phase 6, P2)**: Depends on Foundational and on US4 (the stepper inside the detail sheet shares `useUpdateBinderEntryMutation` with the inline `+`/`−` glyphs from US4). US3 also extends US1's `useCatalogue` to open the sheet — so US1 must be complete.
- **Polish (Phase 7)**: Depends on all user stories being complete.

### User Story Dependencies

```text
Foundational (Phase 2)
        │
        ▼
   User Story 1 (P1) — MVP
        │
        ├─────────────► User Story 2 (P1)  ─────┐
        │                                        ▼
        └─────────────► User Story 4 (P1)  ─► User Story 3 (P2) ─► Polish
```

- **US1** is the strict MVP — every later story extends files US1 creates.
- **US2** and **US4** can be implemented in parallel by two developers once US1 lands; they touch disjoint feature directories on top of US1's `useCatalogue`/`CatalogueView`.
- **US3** is sequenced after US4 because the detail-sheet stepper consumes the same `useUpdateBinderEntryMutation` hook US4 owns, and the sheet's open/close lifecycle is layered on top of US1's `useCatalogue` state.

### Within Each User Story

- Tests MUST be written and MUST fail before implementation (Principle III).
- Models / repositories before services; services before route handlers.
- Core types/schemas before any caller (Foundational phase already covers this).
- Hooks before views; views before containers; containers before screens.
- Story complete before moving to the next priority.

### Parallel Opportunities

- Phase 1 tasks T002 + T003 can run in parallel (distinct files).
- Phase 2 core tasks T004 + T005 + T006 can run in parallel (distinct files).
- Phase 2 server tasks T008 + T010 can run in parallel (distinct files); T009 depends on T008.
- Phase 2 mobile tasks T011 + T012 + T014 can run in parallel; T013 depends on T012; T015 depends on T014.
- All `[P]` test-writing tasks within a single user story can run in parallel.
- Once Foundational is done, US2 and US4 can run in parallel by two developers.

---

## Parallel Example: User Story 1 — Tests

```bash
# Launch all US1 test files in parallel (each is in its own file):
Task: "T016 MtgjsonProvider.test.ts extensions for paper-only + new filter dimensions"
Task: "T018 cardRepository.test.ts numberOwned column coverage"
Task: "T020 cardService.test.ts new filter dimensions + per-user numberOwned join"
Task: "T022 routes/cards.test.ts GET /cards/search with new filters"
Task: "T024 useCatalogueInfiniteQuery.test.ts"
Task: "T027 useCatalogue.test.ts (US1 subset)"
Task: "T029 CatalogueView.test.tsx (US1 subset)"
Task: "T031 CatalogueContainer.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (browse-only Catalogue at parity with the wireframe)
4. **STOP and VALIDATE**: Open the Catalogue, swipe through pages, confirm SC-001/SC-002/SC-003.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → demo browse-only Catalogue (MVP)
3. US2 → demo filtered Catalogue
4. US4 → demo `+`/`−` glyphs + Binder masthead + defer-and-refresh
5. US3 → demo detail sheet with prices and chart
6. Polish → final acceptance + constitution sweep

### Parallel Team Strategy

With multiple developers, after Foundational completes:

- Developer A: US1 (sole owner; everyone else waits)
- Then, in parallel:
  - Developer B: US2 (filter sheet + masthead filter-pill row)
  - Developer C: US4 (mutation hook + Binder refactor + Catalogue glyphs)
- Then sequentially:
  - Developer A or any: US3 (detail sheet + price endpoints + chart)
- Final phase: shared Polish pass.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks in the same phase.
- `[Story]` label maps each task to a specific user story for traceability.
- Tests MUST be written and MUST fail before the corresponding implementation lands (Principle III).
- Every Checkpoint above is gated on `turbo test` + `turbo typecheck` exiting 0 with a **100% Jest pass rate** across the affected workspaces. Investigate every failure at root cause (bleeding state, leaky async, fixture ordering, regression, real defect); `.skip` / `.todo` / quarantine / retry-until-green are prohibited.
- The MTG Goldfish price source was named in the original input. It is deferred to a follow-up specification per spec.md §Clarifications 2026-05-18. The wire shapes ship with two slots (Card Kingdom, TCG Player); the follow-up spec adds a third slot additively without breaking existing consumers.
- Commit after each task or logical group; stop at any checkpoint to validate the story independently.
