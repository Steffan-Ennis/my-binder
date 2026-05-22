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

- [X] T034 [P] [US2] Tests — `apps/mobile/src/components/catalogue-filter-sheet/useCatalogueFilterSheet.test.ts`: holds a `draft` initialised from the `committed` prop; `toggleChip(dimension, value)` mutates only the draft; `onApply()` invokes the consumer's `onApply(draft)`; `onClear()` resets the draft to `EMPTY_FILTER_SET` (does NOT propagate to the consumer's `onClear`); `onClose()` discards the draft.
- [X] T036 [P] [US2] Tests — `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetView.test.tsx`: renders the `Missing only` iOS-style toggle, every dimension's chip row (Set, Format, Super type, Sub type, Creature type), CMC min/max numeric inputs, six colour chips (W/U/B/R/G/C), and the "Clear all" + "Apply" footer buttons; selected chips render with the `selected` style and selected colour chips render the gold ring; tapping "Clear all" fires `onClearAll`; tapping "Apply" fires `onApply(draft)`; tapping the close `×` fires `onClose`.

### Implementation for User Story 2

- [X] T035 [P] [US2] Create `apps/mobile/src/components/catalogue-filter-sheet/types.ts` exporting `UseCatalogueFilterSheetOptions` and the view-props type per contracts/ui.md §4.1.
- [X] T037 [US2] Implement `apps/mobile/src/components/catalogue-filter-sheet/useCatalogueFilterSheet.ts` (working-draft reducer; stable callbacks per Principle X v1.16.0). Makes T034 pass.
- [X] T038 [US2] Implement `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetView.tsx` and `CatalogueFilterSheetView.theme.ts` mirroring the wireframe's `#filterSheet` (uses `BottomSheetModal` from `@gorhom/bottom-sheet`; snap points `['78%']`; close + scrim + swipe-down dismiss). Makes T036 pass.
- [X] T039 [US2] Implement `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetContainer.tsx` (wires hook → view).
- [X] T040 [US2] Extend `apps/mobile/src/components/catalogue/useCatalogue.ts`: feature-local filter reducer initialised from `EMPTY_FILTER_SET`; masthead `isSearchActive`/`searchQuery` state; debounced commit of the search input into `filters.name`; derived `filterPills` array; callbacks `onSearchOpen`, `onSearchChange`, `onSearchClose`, `onFilterSheetOpen`, `onFilterSheetClose`, `onFilterPillRemove`, `onFilterClear`, `onFilterApply` (each memoised). All Principle X v1.26.0 rules honoured.
- [X] T041 [US2] Extend `apps/mobile/src/components/catalogue/CatalogueView.tsx`: wire `<Masthead />` with `subtitle="Catalogue"`, `isSearchActive`, `searchQuery`, `filterPills` slot (renders the chip row + the ⌅ Filters opener), mount the `CatalogueFilterSheetContainer`, and render the `catalogue-empty-state` pane ("no cards match these filters" + "clear filters" affordance) when `pages[0]?.cards.length === 0`. The italic indicator now reads `"N of many"` while `hasNextPage=true` and `"N of M"` once exhausted.
- [X] T042 [US2] Extend `apps/mobile/src/components/catalogue/useCatalogue.test.ts` and `CatalogueView.test.tsx`: `onFilterPillRemove(id)` drops one dimension and refetches; `onFilterClear()` resets to `EMPTY_FILTER_SET`; the zero-match empty state renders the panel + clear-all affordance (FR-015); the indicator switches between `"N of many"` and `"N of M"` correctly (FR-013); the `Missing only` toggle requires authentication and disables when unauthenticated.

**Checkpoint**: User Story 2 functional alongside User Story 1.

> **Phase completion validation gate (Constitution Principle III).** Run
> `turbo test` and `turbo typecheck` across the three workspaces. Both MUST
> exit 0 with a 100% Jest pass rate.

---

## Phase 4.5: Principle X Compliance Sweep (Catalogue + Filter Sheet) 🛑 BLOCKING

**Status**: Inserted 2026-05-18 after the US2 commit (445c943) hit a runtime
context error (`BottomSheetModal` requires `BottomSheetModalProvider` at the
tree root) and a paired audit surfaced multiple Principle X violations
introduced in commits da9a60b (US1) and 445c943 (US2).

**Purpose**: Bring the spec 018 Catalogue + Filter Sheet code into
compliance with `.specify/memory/constitution.md` §X (Component
Architecture, Mobile), the Style co-location rule, and the
Data-fetching hook composition rule (v1.26.0). No new feature work
lands until every task in this phase passes.

**⚠️ CRITICAL**: Phase 5 (US4) MUST NOT begin until Phase 4.5 is complete
and the validation gate at the end of this phase is green.

### Audit findings (from the 2026-05-18 review)

| Tag | File | Rule violated | Issue |
|---|---|---|---|
| A1 | `apps/mobile/src/app/_layout.tsx` | Runtime / library contract | `@gorhom/bottom-sheet` requires `<BottomSheetModalProvider>` (under `<GestureHandlerRootView>`) above any `BottomSheetModal`. Never mounted in the live app — only in `jest.setup.ts`. Root cause of the context error. |
| B1 | `catalogue-filter-sheet/CatalogueFilterSheetView.tsx` lines 8, 131, 133-136 | Layer rules — View Forbidden (`useState`, `useEffect`, `useReducer`); Data-fetching Rule 4 (effects in hook) | View uses `useRef<BottomSheetModal>` + `useEffect` to imperatively `present()`/`dismiss()`. View-layer effects are prohibited. |
| B2 | `catalogue-filter-sheet/CatalogueFilterSheetView.tsx` lines 138-165 | Hook return-value memoisation rule; Data-fetching Rule 4 | View builds per-dimension chip-toggle callbacks (`makeChipToggle`, `toggleSet`, `toggleFormat`, …, `onChangeMin`, `onChangeMax`) with `useCallback`/`useMemo`. Belongs in the hook. |
| B3 | `catalogue/CatalogueView.tsx` line 7 (import) + lines 255-262 (JSX) | Layer rules — view must not own sibling-feature container wiring; Principle IV Single Responsibility | View imports & mounts `CatalogueFilterSheetContainer`. Currently commented out by the user as a workaround for A1. |
| B4 | `catalogue/CatalogueView.tsx` lines 18-50, 52-82, 122-150 | Style co-location rule | `FilterPill`, `FilterOpenerPill`, and the `pillsSlot` wrapper use inline `style={{ paddingHorizontal: …, borderRadius: … }}` literal objects instead of theme entries consumed via `useStyles()`. |
| B5 | `catalogue-filter-sheet/CatalogueFilterSheetView.tsx` line 86 | Style co-location rule (precise-Pick typed entries) | `style={[styles.toggleThumb, value && { alignSelf: 'flex-end' as const }]}` has an inline literal style branch. Should be a `toggleThumbOn` theme entry. |
| B6 | `catalogue/types.ts` lines 67-70 | Data-fetching Rule 5 (`Pick<UseXxxQueryResult, …>`); Rule 3 (don't redeclare `error`) | `CatalogueViewProps` redeclares `hasNextPage`, `isLoading`, `isFetchingNextPage`, `isError` instead of `Pick`ing from `UseInfiniteQueryResult<…, ApiError>`. `error` is missing entirely from the view-props shape. |
| B7 | `catalogue/useCatalogue.ts` lines 52-58 | Code quality (dead code) | `const dimensionLabels: Record<…> = {} as never;` + `void dimensionLabels;` — vestigial. |
| C1 | `catalogue/useCatalogue.ts` | Code quality (testability + hook size) | Pure helpers `filtersToQuery`, `buildPills`, `removePillFromFilters` live in the hook file. Extract to a sibling `catalogueFilters.ts` pure module + unit test. |
| C2 | `catalogue/useCatalogue.ts` line 38 | Code quality (silent data loss) | `if (filters.sets.length > 0) query.set = filters.sets[0];` drops every set after the first. Drop the `sets` dimension from `CatalogueFilterSet` until a future spec adds multi-set wire support. |
| C3 | `catalogue/types.ts` + `catalogue-filter-sheet/types.ts` | Code quality (DRY) | `ColorChip` union declared twice. Consolidate in `catalogue/types.ts`, re-export from `catalogue-filter-sheet/types.ts`. |

### Tasks

- [X] T083 Mount `<GestureHandlerRootView style={{ flex: 1 }}>` → `<BottomSheetModalProvider>` inside the root `<QueryClientProvider>` in `apps/mobile/src/app/_layout.tsx`. Verify the app boots; verify the (still-commented-out) filter sheet would no longer hit the missing-context error. Fixes A1.
- [X] T084 Lift the sheet `ref` + open/dismiss effect from `CatalogueFilterSheetView.tsx` into `useCatalogueFilterSheet.ts`. The hook owns `useRef<BottomSheetModal>(null)` and a `useEffect([open])` that calls `present()`/`dismiss()`; it returns `sheetRef` on its result. The view receives `sheetRef` via props, deletes its own `useRef`/`useEffect`, and passes `ref={sheetRef}` to `<BottomSheetModal>`. Update `useCatalogueFilterSheet.test.ts` for the new ref + effect; update `CatalogueFilterSheetView.test.tsx` to pass a stub ref. Fixes B1.
- [X] T085 Lift per-dimension chip-toggle callbacks (`toggleFormat`, `toggleSuperType`, `toggleSubType`, `toggleCreatureType`, `toggleSet`, `onChangeMin`, `onChangeMax`) from `CatalogueFilterSheetView.tsx` into `useCatalogueFilterSheet.ts` (each `useCallback`). Extend `UseCatalogueFilterSheetResult` + `CatalogueFilterSheetViewProps` to surface them; drop the now-unused `onToggleChip` + `ChipDimension` from the view props (the hook owns the dimension mapping). View deletes every `useCallback`/`useMemo`. Update both tests. Fixes B2.
- [X] T086 Move the `<CatalogueFilterSheetContainer />` mount out of `CatalogueView.tsx` and into `CatalogueContainer.tsx`. Both children read from a single `useCatalogue()` call inside the container; the container renders `<CatalogueView … />` and `<CatalogueFilterSheetContainer open={filterSheetOpen} committed={filters} onApply={onFilterApply} onClear={onFilterClear} onClose={onFilterSheetClose} />` as siblings. Delete the import (line 7) and the JSX block (lines 255-262, currently commented out) from `CatalogueView.tsx`. Update `CatalogueView.test.tsx` (drop the `CatalogueFilterSheetContainer` mock + the "mounts the CatalogueFilterSheetContainer reflecting filterSheetOpen" assertion). Add a sibling-mount assertion to `CatalogueContainer.test.tsx`. Fixes B3.
- [X] T087 Route every `CatalogueView.tsx` inline literal style through `CatalogueView.theme.ts`. Add typed entries `filterPill`, `filterPillLabel`, `filterPillIcon`, `filterOpenerPill`, `filterOpenerLabel`, `filterPillRow`, `filterPillRowSingle` (each `Required<Pick<…>>` matching the constitution's Style co-location rule). The two in-file sub-FCs (`FilterPill`, `FilterOpenerPill`) call `useStyles()` and consume those entries exclusively — no inline literal style objects remain in the file. Fixes B4.
- [X] T088 Add a `toggleThumbOn: Required<Pick<ViewStyle, 'alignSelf'>>` entry to `CatalogueFilterSheetView.theme.ts` and replace line 86's inline `{ alignSelf: 'flex-end' as const }` with `value && styles.toggleThumbOn`. Fixes B5.
- [X] T089 Make `CatalogueViewProps` (`catalogue/types.ts`) compose from `UseInfiniteQueryResult<CatalogueInfiniteData, ApiError>` via `Pick<…, 'error' \| 'isLoading' \| 'isFetchingNextPage' \| 'isError' \| 'hasNextPage'>` and delete those five redeclared fields from the `& { … }` half. Cascade through `useCatalogue.ts` `UseCatalogueResult` Pick, `CatalogueView.tsx` destructure, and the test defaults (`error: null` added to `CatalogueView.test.tsx` and `CatalogueContainer.test.tsx`). Fixes B6.
- [X] T090 Code-quality sweep: delete `dimensionLabels` dead code from `useCatalogue.ts` (B7); extract `filtersToQuery`, `buildPills`, `removePillFromFilters` to a new `catalogue/catalogueFilters.ts` pure module + add `catalogue/catalogueFilters.test.ts` (C1); drop the `sets` dimension from `CatalogueFilterSet` and every consumer until a future spec adds multi-set wire support (C2); consolidate `ColorChip` in `catalogue/types.ts` and re-export from `catalogue-filter-sheet/types.ts` (C3).
- [X] T091 Full validation gate. Run `pnpm turbo test typecheck --filter=@my-binder/core --filter=@my-binder/server --filter=@my-binder/mobile`. Both MUST exit 0 with 100% Jest pass rate. Boot the app and confirm: (a) no `BottomSheetModalProvider` context error; (b) tapping the Filters opener pill mounts the sheet; (c) chip taps stay in draft; (d) Apply commits + closes; (e) pill removal works; (f) Clear all resets. Commit as `fix:018 Principle X compliance sweep` referencing this phase.

**Checkpoint**: Catalogue + filter sheet compliant with Principle X and the
runtime context error is resolved. Phase 5 (US4) may now begin.

> **Phase completion validation gate (Constitution Principle III + IV +
> Principle X).** Both `turbo test` and `turbo typecheck` MUST exit 0
> with 100% Jest pass rate across all three workspaces, AND a manual
> smoke of the filter sheet must work end-to-end. `.skip` / `.todo` /
> quarantine / retry-until-green are prohibited.

---

## Phase 5: User Story 4 — DEFERRED → spec `019-binder-add-remove`

> **Moved out of spec 018 by the 2026-05-22 split.** US4 (add from
> Catalogue / remove from Binder + owned-count glyphs + `Missing only`
> defer-and-refresh) is now owned by spec `019-binder-add-remove`.
>
> **Already implemented + tested on this branch** (so spec 019 inherits a
> done backend): the original T043/T044 (`CardRepository.upsertIncrement` /
> `adjustNumberOwned`) and T045/T046 (`POST /cards` upsert returning
> 200/201, `PATCH /cards/:id` adjust returning 200/204/404) are complete in
> `apps/server/src/repositories/cardRepository.ts` and
> `apps/server/src/routes/cards.ts`, with passing tests. FR-022 (Binder
> adopts the shared `<Masthead />`) is also already done in spec 018.
>
> **Remaining (mobile-only, tracked in spec 019):** the original
> T047/T048 (`useUpdateBinderEntryMutation`), T049–T051 (Catalogue `+`
> glyph + owned-count glyph + defer-and-refresh banner), and T052–T055
> (Binder `−` glyph + owned-count glyph). The Catalogue `useCatalogue` /
> `CatalogueViewProps` already carry forward-reference fields
> (`resultsAreStale`, `onRefreshPress`) that spec 019 will activate.

---

## Phase 6: User Story 3 — DEFERRED → spec `020-card-detail-prices`

> **Moved out of spec 018 by the 2026-05-22 split.** US3 (card detail
> sheet with Card Kingdom + TCG Player prices and a 30-day two-line trend
> chart) is now owned by spec `020-card-detail-prices`. Depends on spec 019
> (the detail-sheet stepper shares the binder-mutation hook).
>
> **Already present on this branch for spec 020 to inherit:** the core
> price types/schemas (`PriceQuote`, `CardPricesResponse`, `PricePoint`,
> `CardPriceHistoryResponse`, `PRICE_*` schemas) from the foundational
> phase, and the `CardProvider.getPrices` / `getPriceHistory` interface
> declarations. The provider methods are **throwing stubs** in
> `apps/server/src/providers/mtgjson/MtgjsonProvider.ts` (they reference
> "pending spec 018 US3 / T057"; that work moves to spec 020).
>
> **Remaining (tracked in spec 020):** the original T056–T077 — implement
> the provider methods, `priceService`, the `prices` routes, the price /
> history / details query hooks, the `card-detail-sheet` feature directory,
> the `PriceTrendChart`, and the sheet wiring into both Catalogue and Binder.

---

## Phase 7: Polish & Cross-Cutting Concerns (US1 + US2 scope)

> ### 🔴 Closeout prerequisite (2026-05-22 split) — make the build green first
>
> The post-Phase-4.5 refactors (filter-state moved to React Context in
> `src/context/catalogue-context/`; the filter sheet moved to an Expo Router
> modal route; the masthead value pills removed, keeping only the
> filter-opener) left `turbo test typecheck` **RED**. Resolve before the
> tasks below:
>
> - `apps/mobile/src/components/catalogue/types.ts` `CatalogueViewProps` no
>   longer declares `filterPills` / `hasNextPage`, but stale tests +
>   `CatalogueContainer.tsx` still reference them — update
>   `CatalogueView.test.tsx`, `useCatalogue.test.ts`,
>   `CatalogueContainer.test.tsx`, and `CatalogueContainer.tsx`.
> - `catalogueFilters.test.ts` imports the removed `buildPills` export — drop it.
> - Delete the orphaned `apps/mobile/src/app/(authenticated)/(tabs)/search.test.tsx`
>   (imports `./search`, renamed to `catalogue/catalogue.tsx`).
> - Confirm `@my-binder/server:test` is green in isolation (turbo aborted on
>   the mobile typecheck failure; server typecheck itself passes).

**Purpose**: Manual acceptance walk-through, full repository validation, and a
final sweep over the new code for constitution compliance — **scoped to US1
(browse) + US2 (filter) only** after the 2026-05-22 split.

- [ ] T078 [P] Run the manual acceptance walkthrough on a simulator for **Catalogue browse + filter only** (the detail-sheet / add-remove / defer-and-refresh steps move to specs 020 / 019). Confirm SC-001/002/003 (paging budgets), SC-004 (filter conjunction), SC-007 (no digital-only printings), SC-008 (shared masthead, no Binder regression), SC-010 (filter/page preserved across tab switch).
- [ ] T079 [P] Run `turbo test` and `turbo typecheck` across all three touched workspaces (`@my-binder/core`, `@my-binder/server`, `@my-binder/mobile`); both MUST exit 0 with a 100% Jest pass rate, with coverage thresholds from T003 honoured. (Blocked on the 🔴 closeout prerequisite above.)
- [ ] T080 Constitution sweep on every file touched by US1+US2: FC declaration rule (`const X: FC<…> = …`), style co-location (`<Component>.theme.ts` sibling), hook return-value memoisation (v1.16.0), data-fetching hook composition (v1.26.0), state locality (the new `catalogue-context` provider replaces prop-drilling for the shared filter set — confirm no new Zustand store), Principle IX (JSDoc + `@example` on every new public function on `cardRepository`, `cardService`, `MtgjsonProvider`, `CardSearchBuilder`).
- [ ] T081 Dependency Currency Check (Principle XI): `@gorhom/bottom-sheet` was the filter sheet's original backing library, but the filter is now an Expo Router modal route and the bottom-sheet detail view moved to spec 020. **Verify whether `@gorhom/bottom-sheet` is still imported anywhere in 018; if not, decide whether to drop it now or keep it pinned at `^5` for spec 020.**
- [ ] T082 Confirm no `.skip` / `xit` / `describe.skip` / `it.todo` exist in any test file added or modified by this feature (Principle III gate).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3, P1)**: Depends on Foundational completion
- **User Story 2 (Phase 4, P1)**: Depends on Foundational; lightly extends US1's `useCatalogue` + `CatalogueView` files but adds the filter sheet as a fresh feature directory. Can begin in parallel with US4 once US1 has landed.
- **Principle X Compliance Sweep (Phase 4.5, BLOCKING)**: Depends on US1 + US2 commits being on the branch. Fixes the runtime `BottomSheetModalProvider` context error and the Principle X violations introduced by US1/US2 (view-layer effects, cross-feature container imports in views, inline styles, view-props that redeclare query-result fields).
- **Phase 5 (US4) and Phase 6 (US3)**: ⛔ **Removed from spec 018 by the 2026-05-22 split** → specs `019-binder-add-remove` and `020-card-detail-prices` respectively. See the deferral blocks above.
- **Polish (Phase 7)**: Scoped to US1 + US2. Depends on the 🔴 closeout prerequisite (green build) plus Phases 1–4.5.

### User Story Dependencies (post-split — spec 018)

```text
Foundational (Phase 2)
        │
        ▼
   User Story 1 (P1) — MVP   (browse)
        │
        ▼
   User Story 2 (P1)         (filter)
        │
        ▼
 ┌──────────────────────────────────────┐
 │ Phase 4.5 — Principle X Compliance   │  🛑 BLOCKING
 │   (T083–T091)                        │
 └──────────────────────────────────────┘
        │
        ▼
   Phase 7 Polish  (after 🔴 build-green closeout)

   [moved out]  US4 → spec 019-binder-add-remove
                US3 → spec 020-card-detail-prices (depends on 019)
```

- **US1** is the strict MVP — US2 extends the files US1 creates.
- **US4 (spec 019)** depends on Foundational + Phase 4.5; its server side is already done on this branch.
- **US3 (spec 020)** depends on US4 (spec 019) — the detail-sheet stepper shares the binder-mutation hook — and on US1's `useCatalogue` for the sheet open/close lifecycle.

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

### Incremental Delivery (post-split — spec 018)

1. Setup + Foundational → Foundation ready
2. US1 → demo browse-only Catalogue (MVP)
3. US2 → demo filtered Catalogue
4. **Phase 4.5** → Principle X compliance sweep
5. 🔴 Closeout → fix the RED build introduced by the Context/pill-removal refactors
6. Phase 7 → final acceptance + constitution sweep (US1 + US2 scope)
7. **Follow-ups** → spec `019-binder-add-remove` (US4), then spec `020-card-detail-prices` (US3)

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks in the same phase.
- `[Story]` label maps each task to a specific user story for traceability.
- Tests MUST be written and MUST fail before the corresponding implementation lands (Principle III).
- Every Checkpoint above is gated on `turbo test` + `turbo typecheck` exiting 0 with a **100% Jest pass rate** across the affected workspaces. Investigate every failure at root cause (bleeding state, leaky async, fixture ordering, regression, real defect); `.skip` / `.todo` / quarantine / retry-until-green are prohibited.
- **2026-05-22 split**: US4 (Phase 5) → spec `019-binder-add-remove`; US3 (Phase 6) → spec `020-card-detail-prices`. The MTG Goldfish source remains deferred beyond US3 (spec.md §Clarifications 2026-05-18); spec 020 ships two slots and a later spec adds the third additively.
- **As-built divergence from this tasks file**: the implementation moved filter state into `src/context/catalogue-context/`, replaced the `@gorhom/bottom-sheet` filter with an Expo Router modal route, made the server catalogue search SQL-native (`CardSearchBuilder`), and removed the masthead value pills (only the filter-opener remains). `plan.md` / `research.md` / `data-model.md` / `contracts/` still describe the superseded design and need a refresh.
- Commit after each task or logical group; stop at any checkpoint to validate the story independently.
