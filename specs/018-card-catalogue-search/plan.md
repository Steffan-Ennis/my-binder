# Implementation Plan: Card Catalogue Search

**Branch**: `018-card-catalogue-search` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-card-catalogue-search/spec.md`
**Design**: [design/wireframe.html](./design/wireframe.html) (clickable wireframe driving every visual decision)

## Summary

Replace the bottom-tab Search route (currently a `<ComingSoonContainer />`
stub from spec 002) with a fully-implemented **Card Catalogue** that
mirrors the Binder tab's visual language: crimson header, paper-cream
canvas, ring-perforated binder page surface, 3×3 pocket grid. The
catalogue browses the global MTGJSON catalogue via
`GET /cards/search` (extended with five new filter dimensions), pages
infinitely with `useInfiniteQuery`, surfaces an owned-count glyph on
each pocket, exposes a `+` quick-add glyph on each pocket, and opens a
shared bottom-sheet card detail view (also adopted by the Binder tab) for
prices and a 30-day price-trend chart.

Three cross-cutting refactors land alongside the catalogue:

1. **Shared `<Masthead />` component** (FR-002, FR-022) extracted from
   the binder-home header and adopted by both Binder and Catalogue. Prop
   slots carry the per-screen subtitle, search-placeholder, callbacks,
   and an optional filter-pill row.
2. **`numberOwned` model on the binder** (FR-023 → FR-031). A
   one-column-additive migration extends `CardEntity`; a new
   `PATCH /cards/:id { delta: 1 | -1 }` endpoint handles inline `+` / `−`
   mutations; `POST /cards` is updated to upsert-increment instead of
   409-on-duplicate; the binder pocket gains a `−` glyph-button and a
   `×N` owned-count glyph for `numberOwned >= 2`.
3. **Card detail sheet** shared between Catalogue and Binder. Driven by
   `@gorhom/bottom-sheet@^5` (one new dependency). Renders the prices
   section + 30-day chart from two new endpoints
   (`GET /cards/:id/prices`, `GET /cards/:id/prices/history`) backed
   **live by the MTGJSON SDK** via two new methods on the existing
   `CardProvider` interface (`getPrices`, `getPriceHistory`). No new
   database table, no new repository, no ingestion job — MTGJSON
   already publishes the dataset and the SDK exposes it as
   `sdk.prices.today` / `sdk.prices.history`. **Two sources in
   scope**: Card Kingdom (`cardkingdom`) and TCG Player (`tcgplayer`).
   The spec originally named MTG Goldfish as a third source; per the
   spec's 2026-05-18 Clarifications entry, MTG Goldfish is deferred
   to a follow-up specification because MTGJSON does not publish that
   dataset and adding it requires bespoke ingestion work. The wire
   shapes (`CardPricesResponse`, `CardPriceHistoryResponse`) are
   designed additively so the follow-up spec can extend the same
   endpoints. See [research.md §7](./research.md#7-price-observation-data-path).

Technical approach (validated against the existing repo):

- **Mobile**: three new feature directories
  (`apps/mobile/src/components/{masthead,catalogue,catalogue-filter-sheet,card-detail-sheet}/`),
  five new cross-feature TanStack hooks
  (`useCatalogueInfiniteQuery`, `useCardPricesQuery`,
  `useCardPriceHistoryQuery`, `useCardDetailsQuery`,
  `useUpdateBinderEntryMutation`), `apiClient` extensions, and a refactor
  of `BinderHomeView` to consume the shared masthead + the new
  `numberOwned` glyph + the new `−` glyph-button. One new dep:
  `@gorhom/bottom-sheet@^5`.
- **Server**: `SEARCH_QUERYSTRING_SCHEMA` extended with five filter
  fields; `MtgjsonProvider.search` extended to plumb them through and
  to mandate paper-only; `cardService.searchCards` extended to join
  `numberOwned` per user when the request is authenticated;
  `cardRepository` gains `upsertIncrement` (POST) and
  `adjustNumberOwned` (PATCH); `CardProvider` interface gains
  `getPrices` + `getPriceHistory` (implemented by `MtgjsonProvider`
  against `sdk.prices.{today,history}`); new thin `priceService` + new
  `prices.ts` route file. **One** new TypeORM migration (adds the
  `number_owned` column to `cards`).
- **Core**: extends `Card`, `CardRecord`, `SearchQuery` with
  `numberOwned`/filter fields; adds `PriceSource`, `PriceQuote`,
  `CardPricesResponse`, `PricePoint`, `CardPriceHistoryResponse`,
  `PatchCardBody` types + matching schemas. All under
  `packages/core/src/{types,schemas}/card.ts` per Principle IX.

The user input ("The icons, search functionality can be lifted")
authorises lifting the wireframe's SVG icons (search glyph, profile
glyph, binder mark, refresh chevron) and the search-expand interaction
verbatim from the wireframe into the mobile implementation. The
`Ionicons` set already in use on mobile satisfies all four glyph needs;
no new asset import is required.

## Technical Context

**Language/Version**: TypeScript ~5.9 (`strict: true`), Node 22 (build/test toolchain only).
**Primary Dependencies** (no version bumps, one new package):

- React Native 0.81.5 + Expo SDK ~54.0 on React 19.1, Expo Router ~6.0
- TanStack Query 5 (`useInfiniteQuery` + `useMutation` with optimistic
  update + cache snapshotting for FR-031 defer-and-refresh)
- Zustand 5 (existing — used for `sessionStore` only; no new stores per
  Principle X State locality rule)
- `react-native-pager-view` ~7.0 (existing — pocket grid pager, same as
  binder)
- `react-native-gesture-handler` ~2.28, `react-native-reanimated` ~4.1
  (existing — peer deps of `@gorhom/bottom-sheet`)
- `react-native-svg` 15.12.1 (existing — used by `Ionicons`; drives the
  30-day chart paths directly per research §6)
- **`@gorhom/bottom-sheet` ^5** (NEW — bottom-sheet behaviour for filter
  sheet + detail sheet; see Dependency Currency Check below)
- `expo-image` ~3.0 (existing — pocket image rendering via spec 017
  `<Card />`)
- `@expo/vector-icons` ^15.0 (existing — Ionicons glyphs)
- `ajv` ^8 (existing — runtime schema validation in `apiClient`)
- `@my-binder/core` workspace (extended with the new types + schemas)

**Server**: Fastify v4, TypeORM 0.3, `pg` 8, `mtgjson-sdk` 0.1.1, all unchanged in
version. Two new migrations land via the existing `pnpm --filter
@my-binder/server migration:run` flow.

**Storage**:

- **Persistent (server)**:
  - `cards` table — new `number_owned INTEGER NOT NULL DEFAULT 1
    CHECK (number_owned >= 1)` column (data-model §1.1).
  - No price-observation table. Price data is served live by the
    MTGJSON SDK via `provider.getPrices` / `provider.getPriceHistory`
    (data-model §2).
- **Persistent (mobile)**: none new. The session JWT in
  `expo-secure-store` from spec 002 is unchanged. No catalogue results
  are persisted to disk — TanStack Query in-memory cache only (mirrors
  the spec 017 FR-015 choice).
- **Ephemeral cache (mobile)**:
  - `['catalogue', 'search', serializedFilters]` — `useInfiniteQuery`
    with `staleTime: 60_000`, `gcTime: 5 * 60_000`.
  - `['cards', 'prices', id]` — `useQuery`, `staleTime: 60_000`.
  - `['cards', 'prices', 'history', id, days]` — `useQuery`,
    `staleTime: 5 * 60_000`.
  - `['cards', 'details', id]` — `useQuery`, `staleTime: 60_000`.

**Testing**: Jest 30 + `jest-expo` SDK 54 preset (mobile),
`@testing-library/react-native` 13, `ts-jest` (server + core). Per
Principle III, no alternative runners. Mobile mocking conventions add
one new entry to `jest.setup.ts` for `@gorhom/bottom-sheet`. Server
route tests follow Principle III rules #1–#5 (real DataSource,
offline-mode SDK, no service/repo mocks, real-data isolation,
factory-driven seeds).

**Target Platform**: iOS 17+ and Android 8+ (Expo SDK 54 baselines,
unchanged from spec 002).
**Project Type**: Mobile-only UI feature with server-side schema
extensions and one new entity. Touches `apps/mobile`, `apps/server`, and
`packages/core` workspaces.

**Performance Goals** (mapped to spec 018 Success Criteria):

- SC-001: Catalogue first interactive page < 2 s.
  `useInfiniteQuery` prefetches the first page eagerly on mount; the
  view renders the skeleton state immediately.
- SC-002: Within-session page navigation completes within one display
  frame — TanStack cache + `react-native-pager-view` `offscreenPageLimit:
  1`.
- SC-003: Cold-cache next-page reveal — skeleton within one frame;
  populated within 1.5s median. Skeleton state is rendered the moment
  `isFetchingNextPage === true`.
- SC-005: 100% of tap-on-populated-pocket events open the detail sheet.
  Pocket `onPress` is wired to a stable `onPocketPress(printingId)`
  callback memoised at the hook boundary.
- SC-006: 30-day chart renders < 1 s after sheet opens. Chart is a
  pure-render `react-native-svg` component with no async work.
- SC-007: Zero digital-only printings — enforced server-side at
  `MtgjsonProvider.search` (`card.availability.includes('paper')`).
- SC-008: Binder tab adopts the shared masthead with zero regressions
  — covered by updates to `BinderHomeView.test.tsx`.
- SC-010: Filter set + page position preserved across in-session tab
  switches — `useFilterReducer` state is held in `useCatalogue` (single
  consumer; Principle X State locality); Expo Router preserves the route
  tree across tab switches inside the active session.
- SC-011: Optimistic glyph update within one frame; server reconcile
  within 1s median — `useUpdateBinderEntryMutation` writes to the
  TanStack cache in `onMutate` before the request fires.
- SC-013: 50+ add/remove cycles per session, no gesture absorption.
  Glyph-buttons are edge-anchored with `hitSlop: 8` and the pocket
  wrapper uses `pointerEvents: 'box-none'` so the swipe gesture passes
  through.

**Constraints**:

- Per Principle X, **no `useState`/`useEffect` in views, screens, or
  containers**. The catalogue, filter-sheet, and detail-sheet feature
  hooks own every piece of state.
- The catalogue MUST NOT introduce a Zustand store — all of its state
  (filter set, sheet open/close flags, defer-refresh flag, current page)
  is single-consumer and lives in `useCatalogue` (Principle X State
  locality rule).
- The masthead component is **stateless** (props-driven). Both
  consumers' hooks own the state; the masthead is a pure presentation
  component.
- The price-history chart uses `react-native-svg` directly. Adding a
  charting library would violate Principle I (Simplicity First) when
  `react-native-svg` is already pinned (no per-render cost) and the
  chart surface is < 200 lines (research §6).
- `numberOwned` MUST be persisted on a per-printing basis (FR-023's
  per-printing scope), already satisfied by the existing `(id, user_id)`
  composite primary key on `cards`. The migration is additive only.
- Price data is served by the MTGJSON SDK directly. There is no
  ingestion concern, no scraping, no fixture seed step — the SDK's
  parquet cache (already on EFS for catalogue search) carries the
  observations. Two sources are in scope (Card Kingdom + TCG Player,
  per the spec's 2026-05-18 Clarifications entry); MTG Goldfish is
  deferred to a follow-up specification (research §7).

**Scale/Scope**:

- Catalogue surface: ~50,000 MTGJSON paper printings. With filters
  applied, typical result sets are 10s–1000s of printings; unfiltered
  browsing surfaces "N of many" via `useInfiniteQuery`.
- Binder surface: 0–1000 cards per user (unchanged from spec 016 scale).
- Detail sheet: one open instance at a time; queries scoped to one
  printing.
- Price observations: served live by the MTGJSON SDK's local parquet
  cache. Per request, the provider issues three parallel SDK queries
  (one per source). Each query reads a few rows from the cache —
  comparable in cost to the existing catalogue-search adapter.

### Outstanding NEEDS CLARIFICATION

None. All ten unknowns enumerated in Phase 0 are resolved in
`research.md`:

1. Shared masthead extraction → new `apps/mobile/src/components/masthead/`
   slice, prop-driven; both consumers' hooks own state.
2. Catalogue paging → `useInfiniteQuery` against `GET /cards/search`
   with `limit=9`.
3. Filter dimensions on `/cards/search` → five new optional querystring
   fields (`formats`, `super_types`, `sub_types`, `creature_types`,
   `missing_only`); paper-only mandated at provider layer.
4. `numberOwned` model + mutations → additive column on `cards`; new
   `PATCH /cards/:id` with `{delta}` body; `POST /cards` upserts on
   duplicate.
5. Bottom-sheet library → `@gorhom/bottom-sheet@^5` (one new dep).
6. 30-day chart → `react-native-svg` direct path drawing; no new dep.
7. Price data path → MTGJSON SDK (`sdk.prices.today` + `sdk.prices.history`)
   via two new methods on the `CardProvider` interface; no new table,
   no ingestion job. Open clarification: MTGJSON does not ship MTG
   Goldfish — default substitute is Cardmarket.
8. Catalogue ↔ binder linkage → `numberOwned` joined per row into
   `/cards/search` responses (LEFT JOIN on `(printing.uuid, user_id)`).
9. Defer-and-refresh affordance → boolean flag in `useCatalogue` set
   by mutation `onSettled`; tap invalidates the catalogue query.
10. Test data fixtures → existing offline-mode MTGJSON SDK cache
    (canonical M11 Lightning Bolt printing).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|---|---|---|
| I  | Simplicity First | ✅ PASS | One new feature directory (Catalogue) + two sheet feature directories + one shared masthead + five cross-feature hooks. No new abstractions beyond what the spec's user stories require. The chart is direct `react-native-svg` paths rather than a charting library. The defer-refresh affordance is a boolean flag, not a new pattern. Optimistic mutation is the canonical TanStack snapshot+rollback shape — no new pattern. |
| II | Data Integrity | ✅ PASS | The `numberOwned` migration is additive with a `CHECK >= 1` invariant. Decrement-to-0 atomically deletes the row inside a transaction. `PATCH /cards/:id` validates `delta ∈ {1, -1}` at Ajv before the handler runs (Principle VII). Price data is read-only from MTGJSON; we never write it, so no data-integrity surface to defend. No card data is silently lost or corrupted. |
| III | Test-First Development | ✅ PASS | Unit Testing Phase below enumerates every Jest file. New `@gorhom/bottom-sheet` mock landing in `apps/mobile/jest.setup.ts` in the same PR per the Mobile mocking convention. New mobile view tests follow the v1.24.0 `ComponentWithDefaults` rule. New server route tests follow rules #1–#5: real DataSource, offline-mode SDK, real services/repositories, factory-driven seeds. **No new test-data factory needed** — price data is read live from the MTGJSON SDK in offline mode, so price tests assert against the same canonical printings already cited in `MtgjsonProvider.test.ts` (e.g. M11 Lightning Bolt at `6ca7af0b-4b6a-59ba-90be-6da4f62bcff1`). The existing `createTestUser` factory covers the per-user seed needs for the new `PATCH /cards/:id` and `numberOwned`-aware search tests. Phase-completion validation gate: every phase exit runs `turbo test && turbo typecheck` to 100% pass. |
| IV | Single Responsibility | ✅ PASS | `<Masthead />` is a pure presentation component used by exactly two consumers via slot props. `useCatalogue` owns catalogue state + catalogue mutations; `useCatalogueFilterSheet` owns the filter sheet's working draft; `useCardDetailSheet` owns sheet lifecycle + price-query composition. `useUpdateBinderEntryMutation` is the single cross-feature mutation hook — Catalogue, Binder, and the detail-sheet stepper all call it. `PriceTrendChart` is a single-purpose pure-render component. |
| V | Transparency & Legibility | ✅ PASS | Every literal (slot count, page size, retry budgets, snap-point percentages, glyph thresholds, swipe-down dismissal threshold) is named (`SLOTS_PER_BINDER_PAGE`, `OWNED_GLYPH_THRESHOLD_BINDER`, `SHEET_DISMISS_THRESHOLD`, etc.). Identifier names describe intent (`catalogueFilterDraft`, `resultsAreStale`, `cardDetailsQuery`, `priceQuoteDisplay`). No placeholder nouns (`state`, `data`, `info`) and no short-form acronyms (`cb`, `e`, `idx`). Single-letter callback parameters (`(p) =>`, `(c) =>`) are absent. Reducer signatures use the domain noun for the state parameter (`catalogueFilterState`, `cardDetailSheetState`). |
| VI | Layered Architecture | ✅ PASS | Mobile → API server only. No direct MTGJSON, Postgres, or Secrets Manager calls from mobile. Card data goes through `provider.search` (existing abstraction); price data goes through `provider.getPrices` / `provider.getPriceHistory` (NEW methods on the same abstraction — see data-model §2.1). The provider abstraction stays the single boundary between the server and external card data; swapping MTGJSON for another provider remains a configuration change. |
| VII | Strong Typing & Schema Validation | ✅ PASS | TypeScript `strict: true` everywhere. Every new wire field has both a TypeScript type in `@my-binder/core` AND a matching Ajv schema (data-model §1.2, §1.3, §1.4, §2.4, §2.5). `apiClient` validates every new response shape via the compiled Ajv validators. `type` aliases used for every new declaration (no `interface`). No `any`; the `userId` field on `SearchQuery` is the only internal-only field and is documented as such. `@root/*` / `@src/*` path aliases used; no `../` imports. The new `CardProvider.getPrices` / `getPriceHistory` methods return the typed wire shapes from `@my-binder/core` directly. |
| VIII | Error Transparency | ✅ PASS | `apiClient` already logs the original error before throwing a typed `ApiError` (existing pattern). New `priceRepository` methods catch and log every DB error before re-throwing. The mutation hook surfaces user-visible toasts on `onError` AND logs the underlying error to `console.error` so observability tooling still receives the stack. No silent swallows. |
| IX | Public API Discipline | ✅ PASS | Every public function/method on the new repository surface (`CardRepository.upsertIncrement`, `CardRepository.adjustNumberOwned`), the new services (`priceService.getCardPrices`, `priceService.getCardPriceHistory`), and the new provider methods (`MtgjsonProvider.getPrices`, `MtgjsonProvider.getPriceHistory`) carries a JSDoc block with `@example`. The new core types are declared in named files under `packages/core/src/types/card.ts` and re-exported only via the existing `index.ts` barrel — index files stay re-export-only. The new mobile feature directories (`masthead`, `catalogue`, `catalogue-filter-sheet`, `card-detail-sheet`) follow the existing `<feature>/` shape with sibling source files; no nested `index.ts` aggregator is introduced. |
| X | Component Architecture (Mobile) | ✅ PASS | Screen → Container → Hook → View enforced for the new Catalogue, filter-sheet, and detail-sheet features. `Masthead` is a pure presentation component with no hook layer (justified: zero state, zero side effects — adding a hook layer would be ceremony, not value, per Principle I). FC declaration rule applied to every new component (`const X: FC<XProps> = …`). Style co-location rule: every new view ships with a sibling `<Component>.theme.ts`. Hook return-value memoisation rule (v1.16.0): every non-primitive returned by `useCatalogue`, `useCatalogueFilterSheet`, `useCardDetailSheet` is `useMemo`/`useCallback` wrapped with exhaustive deps. Data-fetching hook composition rule (v1.26.0): every new feature hook destructures its query result, derives view-shaped data with `useMemo`, passes `error` through without redeclaring it (`Pick`'d on the view-props type), encapsulates side effects in the hook, and uses named `Use<Feature>Options` types in `types.ts`. State locality rule: every new piece of state is single-consumer — no new Zustand store. `useEffect` is used only for the chart's pulse-on-glyph-appearance animation (`Animated.spring` driver) which is a mount/animation-bound external system. |
| XI | Dependency Currency | ⚠ ATTEND | One new package: `@gorhom/bottom-sheet@^5`. Per registry lookup the current stable is in the v5.x line, matched by `^5`. See the Dependency Currency Check table below — selection is at current stable, no off-stable justification required. |

**Pre-implementation gates**: All cleared. `/speckit.tasks` is unblocked.

**Post-Phase-1 re-check (2026-05-18, after research.md + data-model.md + contracts/{api,ui}.md + quickstart.md, then refactored to source prices from the MTGJSON SDK per user direction and to defer MTG Goldfish to a follow-up specification per the spec's 2026-05-18 Clarifications entry)**: re-evaluated all eleven principles against the design artifacts. No new violations surfaced. The shared-masthead extraction, the `numberOwned` migration, the optimistic-mutation hook composition, the MTGJSON-backed two-source price endpoints, and the per-feature filter-state ownership all land inside existing principle envelopes. The MTG Goldfish gap is recorded as an explicit Out-of-Scope item in spec.md and is invisible to the mobile client (the wire shapes ship with two slots; future ingestion adds a third additively). Phase 2 (`/speckit.tasks`) is unblocked.

### Dependency Currency Check (Principle XI)

One new package introduced by this feature.

| Package | Workspace | Chosen version | Current stable | Justification (only if off-stable) |
|---|---|---|---|---|
| `@gorhom/bottom-sheet` | `apps/mobile` | `^5` (latest v5 release) | `^5` | _at current stable — no entry needed_ |

`@gorhom/bottom-sheet` v5 is the registry-current stable as of feature
start. Its peer deps (`react-native-reanimated`, `react-native-gesture-handler`)
are already installed at SDK 54-pinned versions from spec 002 — no
peer-dep bump is required.

## Project Structure

### Documentation (this feature)

```text
specs/018-card-catalogue-search/
├── plan.md                  # This file
├── research.md              # Phase 0 — 10 NEEDS CLARIFICATION resolutions
├── data-model.md            # Phase 1 — entity modifications, new entities, mobile shapes
├── quickstart.md            # Phase 1 — local-dev walkthrough, US1–US4 acceptance
├── contracts/
│   ├── api.md               # Phase 1 — HTTP deltas (3 modified, 4 new endpoints)
│   └── ui.md                # Phase 1 — mobile UI surfaces (masthead, catalogue, sheets, hooks)
├── design/
│   └── wireframe.html       # Pre-existing — clickable wireframe driving every visual decision
├── checklists/
│   └── requirements.md      # Pre-existing — created by /speckit.specify
├── spec.md                  # Pre-existing — feature specification
└── tasks.md                 # Phase 2 — created by /speckit.tasks (NOT by /speckit.plan)
```

### Source Code (repository root)

Only paths added or modified by this feature are shown.

```text
my-binder/
├── packages/core/src/
│   ├── types/
│   │   ├── card.ts                        # MODIFY — extend SearchQuery + CardRecord (numberOwned); NEW exports PriceSource, PriceQuote, CardPricesResponse, PricePoint, CardPriceHistoryResponse
│   │   └── crud.ts                        # MODIFY — extend Card with numberOwned; NEW export PatchCardBody
│   └── schemas/
│       └── card.ts                        # MODIFY — extend CARD_RESPONSE_SCHEMA, CARD_RECORD_SCHEMA, SEARCH_QUERYSTRING_SCHEMA; NEW PRICE_QUOTE_SCHEMA, CARD_PRICES_RESPONSE_SCHEMA, PRICE_POINT_SCHEMA, CARD_PRICE_HISTORY_RESPONSE_SCHEMA, PATCH_CARD_BODY_SCHEMA
│
├── apps/server/
│   ├── src/
│   │   ├── db/migrations/
│   │   │   └── <ts>-add-number-owned.ts           # NEW — adds cards.number_owned INTEGER NOT NULL DEFAULT 1 CHECK >= 1
│   │   ├── entities/
│   │   │   └── CardEntity.ts                      # MODIFY — adds @Column numberOwned
│   │   ├── repositories/
│   │   │   ├── cardRepository.ts                  # MODIFY — adds upsertIncrement(), adjustNumberOwned(); existing methods load numberOwned
│   │   │   └── cardRepository.test.ts             # MODIFY — covers new methods + numberOwned column
│   │   ├── routes/
│   │   │   ├── cards.ts                           # MODIFY — POST /cards now upserts; NEW PATCH /cards/:id; GET /cards & GET /cards/search emit numberOwned
│   │   │   ├── cards.test.ts                      # MODIFY — adds duplicate-POST, PATCH increment/decrement/204, search filters, numberOwned join
│   │   │   ├── prices.ts                          # NEW — GET /cards/:id/prices + GET /cards/:id/prices/history (delegate to priceService → provider)
│   │   │   └── prices.test.ts                     # NEW — E2E against offline-mode MTGJSON SDK (no fixture seeds)
│   │   ├── services/
│   │   │   ├── cardService.ts                     # MODIFY — searchCards accepts the new filter dimensions + userId; joins numberOwned; mandates paper-only at provider layer
│   │   │   ├── cardService.test.ts                # MODIFY — covers new filter dimensions + paper-only
│   │   │   ├── priceService.ts                    # NEW — thin wrapper over provider.getPrices / getPriceHistory with ProviderUnavailableError rewriting
│   │   │   └── priceService.test.ts               # NEW — covers happy path + 404 + provider-down → 503
│   │   └── providers/
│   │       ├── interface.ts                       # MODIFY — adds getPrices(uuid) + getPriceHistory(uuid, days) to CardProvider
│   │       └── mtgjson/
│   │           ├── MtgjsonProvider.ts             # MODIFY — search() plumbs formats/superTypes/subTypes/creatureTypes + filters availability.includes('paper'); NEW getPrices/getPriceHistory backed by sdk.prices.today / sdk.prices.history
│   │           └── MtgjsonProvider.test.ts        # MODIFY — covers the new search dimensions + the new price methods
│
└── apps/mobile/
    ├── jest.setup.ts                              # MODIFY — adds @gorhom/bottom-sheet default mock
    ├── package.json                               # MODIFY — adds @gorhom/bottom-sheet ^5
    ├── app/(authenticated)/(tabs)/
    │   ├── _layout.tsx                            # MODIFY — headerShown:false on the Search Tabs.Screen
    │   └── search.tsx                             # MODIFY — render <CatalogueContainer />
    └── src/
        ├── components/
        │   ├── masthead/                          # NEW — shared masthead (FR-002 / FR-022)
        │   │   ├── Masthead.tsx
        │   │   ├── Masthead.theme.ts
        │   │   ├── Masthead.test.tsx
        │   │   └── types.ts
        │   ├── binder-home/
        │   │   ├── BinderHomeView.tsx             # MODIFY — replace inline header with <Masthead />; add −/glyph overlays
        │   │   ├── BinderHomeView.test.tsx        # MODIFY — adapt masthead assertions to child-component shape; cover −/glyph
        │   │   ├── useBinderHome.ts               # MODIFY — expose mastheadProps; consume useUpdateBinderEntryMutation
        │   │   └── useBinderHome.test.ts          # MODIFY — cover new mutation + masthead-props derivation
        │   ├── catalogue/                         # NEW — catalogue feature slice
        │   │   ├── CatalogueContainer.tsx
        │   │   ├── CatalogueContainer.test.tsx
        │   │   ├── CatalogueView.tsx
        │   │   ├── CatalogueView.theme.ts
        │   │   ├── CatalogueView.test.tsx
        │   │   ├── useCatalogue.ts
        │   │   ├── useCatalogue.test.ts
        │   │   └── types.ts
        │   ├── catalogue-filter-sheet/            # NEW — filter sheet
        │   │   ├── CatalogueFilterSheetContainer.tsx
        │   │   ├── CatalogueFilterSheetView.tsx
        │   │   ├── CatalogueFilterSheetView.theme.ts
        │   │   ├── CatalogueFilterSheetView.test.tsx
        │   │   ├── useCatalogueFilterSheet.ts
        │   │   ├── useCatalogueFilterSheet.test.ts
        │   │   └── types.ts
        │   └── card-detail-sheet/                 # NEW — shared detail sheet
        │       ├── CardDetailSheetContainer.tsx
        │       ├── CardDetailSheetView.tsx
        │       ├── CardDetailSheetView.theme.ts
        │       ├── CardDetailSheetView.test.tsx
        │       ├── PriceTrendChart.tsx
        │       ├── PriceTrendChart.theme.ts
        │       ├── PriceTrendChart.test.tsx
        │       ├── useCardDetailSheet.ts
        │       ├── useCardDetailSheet.test.ts
        │       └── types.ts
        ├── hooks/
        │   ├── useCatalogueInfiniteQuery.ts       # NEW
        │   ├── useCatalogueInfiniteQuery.test.ts  # NEW
        │   ├── useCardPricesQuery.ts              # NEW
        │   ├── useCardPricesQuery.test.ts         # NEW
        │   ├── useCardPriceHistoryQuery.ts        # NEW
        │   ├── useCardPriceHistoryQuery.test.ts   # NEW
        │   ├── useCardDetailsQuery.ts             # NEW
        │   ├── useCardDetailsQuery.test.ts        # NEW
        │   ├── useUpdateBinderEntryMutation.ts    # NEW (cross-feature mutation owner)
        │   └── useUpdateBinderEntryMutation.test.tsx  # NEW
        └── services/api/
            ├── apiClient.ts                       # MODIFY — adds searchCards, getCardPrices, getCardPriceHistory, getCard, upsertCard, patchCard
            ├── apiClient.test.ts                  # MODIFY — adds coverage for the six new client methods
            └── schemas.ts                         # UNCHANGED — re-exports from @my-binder/core via barrel
```

**Structure Decision**: Three-workspace touch (`packages/core` +
`apps/server` + `apps/mobile`), with the bulk of the new code in
`apps/mobile/src/components/{masthead,catalogue,catalogue-filter-sheet,card-detail-sheet}/`
as four Principle X feature slices. Server-side adds **one** TypeORM
migration (`number_owned` column), one new route file (`prices.ts`),
one new thin service (`priceService.ts`), and extends `cards.ts` +
`cardService.ts` + `cardRepository.ts` + `providers/interface.ts` +
`MtgjsonProvider.ts`. No new entity, repository, or factory — price
data is served live by the MTGJSON SDK via the extended provider
interface. Core adds the wire-shape types + schemas needed by the
new endpoints (`PriceSource`, `PriceQuote`, `CardPricesResponse`,
`PricePoint`, `CardPriceHistoryResponse`, `PatchCardBody`, plus the
matching Ajv schemas and `numberOwned` extensions on existing card
schemas).

## Unit Testing Phase

*GATE: REQUIRED per Constitution Principle III. A plan without a completed
Unit Testing Phase MUST NOT proceed to task generation.*

**Test framework**: Jest 30 with the `jest-expo` SDK 54 preset (mobile),
`ts-jest` (server + core). Co-located `<filename>.test.ts(x)` per Principle
III. Per the test co-location rule, no `tests/` directory is introduced;
each test file sits next to the file under test.

### Mobile mocking conventions (Principle III sub-rule)

This feature introduces **one new third-party module** that touches
React Native at runtime: `@gorhom/bottom-sheet`. Per the rule, the
default mock MUST land in `apps/mobile/jest.setup.ts` in the same PR:

```ts
// apps/mobile/jest.setup.ts (added)
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Pressable } = require('react-native');

  type SheetRef = { present: () => void; dismiss: () => void };

  const BottomSheetModal = React.forwardRef<SheetRef, { children?: React.ReactNode }>(
    ({ children }, ref) => {
      const [visible, setVisible] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
        dismiss: () => setVisible(false),
      }));
      return visible ? React.createElement(View, { testID: 'bottom-sheet' }, children) : null;
    },
  );

  const BottomSheetModalProvider = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);

  const BottomSheetBackdrop = ({ onPress }: { onPress?: () => void }) =>
    React.createElement(Pressable, { testID: 'bottom-sheet-backdrop', onPress });

  const BottomSheetScrollView = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);

  return {
    __esModule: true,
    default: BottomSheetModal,
    BottomSheetModal,
    BottomSheetModalProvider,
    BottomSheetBackdrop,
    BottomSheetScrollView,
  };
});
```

Per-test spies for `present` / `dismiss` are layered via typed
`jest.spyOn` in each test's `beforeEach`, per the existing convention.

### Mobile view test conventions (Principle III sub-rule)

Every new `*View.test.tsx` file under
`apps/mobile/src/components/{masthead,catalogue,catalogue-filter-sheet,card-detail-sheet}/`
follows the v1.24.0 rule: `render(...)` is called only inside `it(...)`;
a `<ComponentName>WithDefaults: FC<Partial<<Component>Props>>` is
declared at module scope spreading a `defaults` object over the
production view. Canonical reference:
`apps/mobile/src/components/binder-home/BinderHomeView.test.tsx`.

### Server route test conventions (Principle III sub-rule)

`apps/server/src/routes/cards.test.ts` (modified) and
`apps/server/src/routes/prices.test.ts` (new) follow rules #1–#5: real
`DataSource` via `initDataSource(...)` in `beforeAll`, offline-mode
MTGJSON SDK via `MtgjsonSDK.create({ cacheDir, offline: true })`, no
service or repository mocks, real-data isolation via explicit deletes
in `afterEach`, and seeds via factories under `apps/server/testing/`.

**No new test-data factory is required by this feature.** Price data
is read live from the offline-mode MTGJSON SDK, so price tests assert
against the same canonical printings already cited in
`MtgjsonProvider.test.ts` (e.g. M11 Lightning Bolt at
`6ca7af0b-4b6a-59ba-90be-6da4f62bcff1`). The existing `createTestUser`
factory covers cards.test.ts + prices.test.ts user seeding.

### Data-fetching hook composition (Principle X v1.26.0)

Every new `use<Feature>.ts` hook that wraps a TanStack primitive
follows the seven rules:

1. **Destructures the query result** at the hook boundary —
   `useCatalogue` reads `data`, `error`, `isLoading`, `fetchNextPage`,
   `hasNextPage`, `isFetchingNextPage` from `useCatalogueInfiniteQuery`
   into named locals; `useCardDetailSheet` does the same against
   `useCardImagesQuery`, `useCardPricesQuery`, `useCardPriceHistoryQuery`.
2. **Derives view-shaped data with `useMemo`** — `pages`,
   `totalPages`, `summaryCaption`, `filterPills` are memoised.
3. **Passes `error` through without redeclaring** — view-props
   `Pick<UseInfiniteQueryResult<…>, 'error' | 'isLoading' | 'isFetchingNextPage'>`.
4. **Encapsulates side effects in the hook** — the catalogue's pager
   selected-page handler, the sheet's open/close imperative refs, and
   the chart's pulse animation all live in their feature hooks.
5. **Derives view props via `Pick`** — `CatalogueViewProps` and
   `CardDetailViewProps` are `Pick`'d unions per data-model §3.3, §4.
6. **Names hook options as `Use<Feature>Options`** —
   `UseCatalogueOptions`, `UseCatalogueFilterSheetOptions`,
   `UseCardDetailSheetOptions`.
7. **Feature-local `types.ts`** — each new feature directory ships a
   `types.ts` colocated with the hook + view + container.

### Test files to create or update

| Test file | Status | Behaviours covered (mapped to FR-### where applicable) |
|---|---|---|
| `packages/core/src/schemas/card.test.ts` | new (if absent) or update | • `CARD_RESPONSE_SCHEMA` accepts `numberOwned` (int >= 0) [§1.2]<br>• `CARD_RECORD_SCHEMA` accepts `numberOwned` [§1.3]<br>• `SEARCH_QUERYSTRING_SCHEMA` accepts each new field [§1.4]<br>• `PRICE_QUOTE_SCHEMA` accepts a `PriceQuote` object OR `null` [§2.3]<br>• `CARD_PRICES_RESPONSE_SCHEMA` requires all three source slots [§2.3]<br>• `CARD_PRICE_HISTORY_RESPONSE_SCHEMA` validates per-source arrays [§2.3]<br>• `PATCH_CARD_BODY_SCHEMA` rejects `delta` values other than `1` or `-1` [§2.4] |
| `apps/server/src/repositories/cardRepository.test.ts` | update | • `findAll` returns `numberOwned` on every row [FR-022, FR-023]<br>• `upsertIncrement` creates a fresh row at `numberOwned=1` [FR-025]<br>• `upsertIncrement` on duplicate `(id, user_id)` increments [FR-025]<br>• `adjustNumberOwned(delta:+1)` increments [FR-028]<br>• `adjustNumberOwned(delta:-1)` decrements while count > 1 [FR-026]<br>• `adjustNumberOwned(delta:-1)` at count = 1 deletes the row in the same transaction [FR-026] |
| `apps/server/src/services/cardService.test.ts` | update | • `searchCards({…, missingOnly:true, userId})` excludes printings the user owns [FR-005, FR-023]<br>• `searchCards({formats:['Modern']})` excludes printings not legal in Modern [FR-005, FR-006]<br>• `searchCards({superTypes:['Legendary']})` excludes non-Legendary printings [FR-005]<br>• `searchCards({creatureTypes:['Elf']})` excludes non-Elf creatures [FR-005]<br>• Every search response excludes digital-only printings (FR-021) [SC-007]<br>• Each response item carries `numberOwned` when `userId` is set; absent when not |
| `apps/server/src/services/priceService.test.ts` | new | • `getCardPrices` delegates to `provider.getPrices` and wraps thrown errors as `ProviderUnavailableError`<br>• `getCardPriceHistory` delegates to `provider.getPriceHistory` with default `days=30`<br>• Returns the response shape unchanged when the provider returns successfully |
| `apps/server/src/providers/mtgjson/MtgjsonProvider.test.ts` | update | • `search({formats})` forwards to `sdk.cards.search({legalities: …})` [FR-005]<br>• `search({superTypes})` forwards to `sdk.cards.search({supertypes: …})` [FR-005]<br>• `search` filters `availability.includes('paper')` before returning [FR-021, SC-007]<br>• NEW: `getPrices(uuid)` fans out two `sdk.prices.today` calls (one per in-scope source) and returns `{cardKingdom, tcgPlayer}` slots [FR-017]<br>• NEW: `getPrices` returns `null` per slot when MTGJSON has no observation for that (printing, provider) pair [FR-019]<br>• NEW: `getPriceHistory(uuid, 30)` fans out two `sdk.prices.history` calls with `dateFrom = today - 30 days`<br>• NEW: `getPriceHistory` returns empty array per source when no observations within the window [FR-019]<br>• NEW: Provider key mapping pins `CARD_KINGDOM → cardkingdom` and `TCG_PLAYER → tcgplayer` only — MTG Goldfish is deferred per spec's 2026-05-18 Clarifications entry |
| `apps/server/src/routes/cards.test.ts` | update | • `POST /cards` first insert returns 201 with `numberOwned=1` [FR-023]<br>• `POST /cards` duplicate returns 200 with incremented `numberOwned` [FR-025]<br>• `PATCH /cards/:id { delta: +1 }` returns 200 with incremented count [FR-028]<br>• `PATCH /cards/:id { delta: -1 }` at `numberOwned=2` returns 200 with count 1 [FR-026, FR-028]<br>• `PATCH /cards/:id { delta: -1 }` at `numberOwned=1` returns 204 (row deleted) [FR-026]<br>• `PATCH /cards/:id { delta: -1 }` against non-existent row returns 404<br>• `PATCH /cards/:id { delta: 0 }` returns 400 VALIDATION_ERROR<br>• `GET /cards` includes `numberOwned` on every row [FR-022]<br>• `GET /cards/search?formats=Modern&missing_only=true` honours both filters [FR-005, FR-006]<br>• `GET /cards/search?missing_only=true` unauthenticated returns 401 |
| `apps/server/src/routes/prices.test.ts` | new | • `GET /cards/:id/prices` for unknown UUID returns 404 [§5a]<br>• `GET /cards/:id/prices` for valid printing with no MTGJSON observations returns 200 + three `null` slots [FR-019]<br>• `GET /cards/:id/prices` for a printing MTGJSON has prices for returns the latest per source [FR-017]<br>• `GET /cards/:id/prices/history?days=30` returns per-source arrays for the last 30 days [FR-018]<br>• `GET /cards/:id/prices/history` defaults to `days=30` when omitted<br>• Both endpoints require authentication |
| `apps/mobile/src/services/api/apiClient.test.ts` | update | • `searchCards(query)` serialises filter arrays as comma-separated strings<br>• `getCardPrices(id)` parses `CardPricesResponse` schema<br>• `getCardPriceHistory(id, days)` parses `CardPriceHistoryResponse` schema<br>• `getCard(id)` returns 404 → throws `ApiError('NOT_FOUND')`<br>• `upsertCard({id, name})` calls `POST /cards`<br>• `patchCard(id, {delta})` returns `{status:200, card}` OR `{status:204}` |
| `apps/mobile/src/hooks/useCatalogueInfiniteQuery.test.ts` | new | • returns the validated `cards` flat list across pages [FR-009]<br>• `getNextPageParam` returns `undefined` when `page === totalPages` [FR-014]<br>• `enabled` gate honours `useSession().status === 'active'`<br>• `queryKey` includes serialised filters → cache misses when filters change [FR-008] |
| `apps/mobile/src/hooks/useCardPricesQuery.test.ts` | new | • returns null slots for printings with no observations [FR-019]<br>• returns populated quotes for seeded printings [FR-017]<br>• `enabled` gated on non-null `id` |
| `apps/mobile/src/hooks/useCardPriceHistoryQuery.test.ts` | new | • returns per-source arrays [FR-018]<br>• default window `days = 30` [FR-018] |
| `apps/mobile/src/hooks/useCardDetailsQuery.test.ts` | new | • returns the validated `Card` for a known id<br>• throws `ApiError('NOT_FOUND')` on 404 |
| `apps/mobile/src/hooks/useUpdateBinderEntryMutation.test.tsx` | new | • `onMutate(delta:+1)` optimistically increments `numberOwned` in both `['cards','list']` and every `['catalogue','search', …]` cache [SC-011]<br>• `onMutate(delta:-1)` at `numberOwned=1` removes the binder row and zeros the catalogue row<br>• `onError` rolls back both caches to the snapshot<br>• `onSettled` invalidates `['cards','list']`<br>• `onSettled` publishes "binderMutationLanded" signal consumed by `useCatalogue` to set `resultsAreStale=true` [FR-031] |
| `apps/mobile/src/components/masthead/Masthead.test.tsx` | new | • renders `subtitle` + `MY-BINDER` overline + binder icon when `isSearchActive=false`<br>• renders inline `TextInput` when `isSearchActive=true`<br>• tapping the search button fires `onSearchOpen` [FR-002]<br>• tapping the profile button fires `onProfilePress` [FR-002]<br>• tapping the close button fires `onSearchClose`<br>• typing in the input fires `onSearchChange`<br>• renders `filterPills` slot when provided<br>• gold-dot indicator visible when `hasActiveQuery=true` |
| `apps/mobile/src/components/binder-home/BinderHomeView.test.tsx` | update | • renders `<Masthead />` as a child component (not inline) — verifies the spec 016 header was removed [FR-022]<br>• binder pocket renders `+` glyph-button (catalogue-style) NO, `−` glyph-button YES [FR-026]<br>• tapping the binder pocket `−` glyph fires `onPocketRemove(id)` [FR-026]<br>• owned-count glyph visible when `numberOwned >= 2`, hidden when `numberOwned === 1` [FR-024]<br>• zero regressions on existing SC-006 assertions (`pocket-occupied`/`pocket-empty`/`binder-page-ring`) |
| `apps/mobile/src/components/binder-home/useBinderHome.test.ts` | update | • exposes `mastheadProps` object derived from existing search/profile callbacks<br>• `onPocketRemove(id)` calls `useUpdateBinderEntryMutation` with `{delta:-1}` [FR-026]<br>• binder grid recomputes total pages and summary caption when a row is removed [FR-026] |
| `apps/mobile/src/components/catalogue/useCatalogue.test.ts` | new | • returns memoised `pages`, `currentPage`, `totalPages`, `summaryCaption`, callbacks [Principle X v1.16.0]<br>• `summaryCaption` reads `"N+ MATCHES · 9 PER PAGE"` when open-ended, `"N MATCHES · M PAGES"` when complete [FR-013]<br>• `onPocketAddPress(id)` calls `useUpdateBinderEntryMutation({delta:+1})` [FR-025]<br>• `onPocketPress(id)` opens the detail sheet for that id [FR-016]<br>• `onFilterPillRemove(id)` removes that one filter and refetches [FR-008]<br>• `onFilterClear()` resets to `EMPTY_FILTER_SET` and refetches [FR-008]<br>• Adding a card with `Missing only` active sets `resultsAreStale=true` and does NOT refetch [FR-031]<br>• `onRefreshPress()` invalidates the catalogue query and clears the stale flag [FR-031] |
| `apps/mobile/src/components/catalogue/CatalogueView.test.tsx` | new | • renders the masthead, summary caption, binder page surface, 3×3 grid, pager indicator (no flanking arrows) [FR-001, FR-010]<br>• skeleton pockets render while `isLoading` [FR-012]<br>• populated pockets render `<Card />` + `+` glyph-button + `×N` glyph (when owned) [FR-024, FR-025]<br>• tapping a populated pocket fires `onPocketPress(id)` [FR-016]<br>• tapping the `+` glyph fires `onPocketAddPress(id)` and stops propagation [FR-025, FR-027]<br>• `noMatches` state renders the inline "no cards match these filters" pane + clear-all affordance [FR-015]<br>• `resultsAreStale` renders the refresh banner [FR-031]<br>• indicator reads "N of many" when `hasNextPage=true`, "N of M" otherwise [FR-013] |
| `apps/mobile/src/components/catalogue/CatalogueContainer.test.tsx` | new | • wires `useCatalogue` → `<CatalogueView />` with named props (no spread) [Principle X Container prop-passing rule] |
| `apps/mobile/src/components/catalogue-filter-sheet/useCatalogueFilterSheet.test.ts` | new | • holds a `draft` initialised from the `committed` prop<br>• `toggleChip(dimension, value)` updates the draft only<br>• `onApply()` calls the consumer's `onApply(draft)`<br>• `onClear()` resets the draft to `EMPTY_FILTER_SET` (does NOT call consumer's `onClear`)<br>• `onClose()` discards the draft |
| `apps/mobile/src/components/catalogue-filter-sheet/CatalogueFilterSheetView.test.tsx` | new | • renders the Missing-only toggle (FR-005), every chip row, the CMC range inputs, the colour-identity chips, the Clear-all + Apply buttons<br>• selected chips have the `selected` style<br>• tapping "Clear all" fires `onClearAll`<br>• tapping "Apply" fires `onApply(draft)`<br>• tapping the close button fires `onClose` |
| `apps/mobile/src/components/card-detail-sheet/useCardDetailSheet.test.ts` | new | • returns `name`, `setCode`, `setName`, `typeLine`, `oracleText`, `artUrl` from `useCardDetailsQuery` + `useCardImagesQuery`<br>• returns `numberOwned`, `canDecrement` (false when 0) derived from cache<br>• `onIncrement` / `onDecrement` call `useUpdateBinderEntryMutation`<br>• `cardKingdomPrice`/`tcgPlayerPrice` formatted display values; "—" when source has no observation [FR-019]<br>• `priceHistory` passed through unchanged [FR-018] |
| `apps/mobile/src/components/card-detail-sheet/CardDetailSheetView.test.tsx` | new | • renders the hero with name/set/type/oracle [FR-016]<br>• renders the stepper with `numberOwned` and `−`/`+` controls [FR-028]<br>• `−` button disabled when `canDecrement=false` [FR-028]<br>• renders three price rows with formatted values OR "—" [FR-017, FR-019]<br>• renders the chart (with three lines OR the "no recent price data" annotation) [FR-018, FR-019]<br>• tapping the close control fires `onClose` [FR-020] |
| `apps/mobile/src/components/card-detail-sheet/PriceTrendChart.test.tsx` | new | • renders three SVG `<Path>` elements when all three series are non-empty [FR-018]<br>• renders the legend with three entries [FR-018]<br>• renders only the axes + "no recent price data" annotation when every series is empty [FR-019]<br>• y-axis range computed from `min*0.95` to `max*1.05` |

E2E coverage of the swipe gesture, the sheet's swipe-down dismissal, and
the optimistic-update race window is **deferred** to a future
Detox/Maestro spec (out of scope, mirrors the spec 016 / 017 deferral).

### Coverage target

```jsonc
// apps/mobile/jest.config.ts — coverageThreshold for new files in this feature
{
  "coverageThreshold": {
    "global":  { "branches": 80, "functions": 80, "lines": 80, "statements": 80 },
    "apps/mobile/src/components/masthead/**/*.{ts,tsx}":              { "branches": 90, "functions": 90, "lines": 90, "statements": 90 },
    "apps/mobile/src/components/catalogue/**/*.{ts,tsx}":             { "branches": 85, "functions": 85, "lines": 85, "statements": 85 },
    "apps/mobile/src/components/catalogue-filter-sheet/**/*.{ts,tsx}":{ "branches": 85, "functions": 85, "lines": 85, "statements": 85 },
    "apps/mobile/src/components/card-detail-sheet/**/*.{ts,tsx}":     { "branches": 85, "functions": 85, "lines": 85, "statements": 85 },
    "apps/mobile/src/hooks/useUpdateBinderEntryMutation.ts":           { "branches": 90, "functions": 90, "lines": 90, "statements": 90 }
  }
}
```

The masthead component is held to 90% because it is consumed by both the
Binder and the Catalogue — a regression in its render contract silently
breaks two screens at once. The optimistic-mutation hook is held to 90%
because its rollback path is the SC-011 / SC-012 safety net.
Catalogue + sheet feature directories are held to 85% to keep the
test surface honest without over-fitting on view-layer JSX.

The server side inherits the workspace's 80% default — new repositories
and services are pure functions over the TypeORM DataSource and clear
the threshold comfortably.

### Test execution

```bash
# Per-workspace, during development
pnpm --filter @my-binder/core   test
pnpm --filter @my-binder/server test
pnpm --filter @my-binder/mobile test

# Watch mode for a feature directory
pnpm --filter @my-binder/mobile test -- --watch src/components/catalogue

# Phase gate (every phase exit per Principle III)
turbo test
turbo typecheck
```

Both MUST exit `0` for each phase exit per Principle III's Phase
completion validation gate. No `it.skip` / `xit` / `describe.skip` is
permitted to bypass a failing test.

## Complexity Tracking

> No constitution violations to justify. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | _n/a_ | _n/a_ |

Two deliberate scope choices are recorded here for traceability (they
are not constitution violations):

1. **The shared `<Masthead />` component is a pure presentation
   component with no hook layer.** Principle X mandates the Container →
   Hook → View pattern for *features*; the masthead is not a feature —
   it is a reusable presentation primitive owned by zero internal state.
   The two consumers (`useBinderHome`, `useCatalogue`) own every piece
   of state the masthead displays and hand it down via props. Adding a
   `useMasthead.ts` would be empty ceremony.
2. **The MTG Goldfish price source is deferred to a follow-up
   specification.** MTGJSON does not publish MTG Goldfish data. Per
   the spec's 2026-05-18 Clarifications entry, this spec ships two
   sources (Card Kingdom + TCG Player); a future specification will
   own the MTG Goldfish ingestion (third-party data acquisition,
   scheduling, licensing review). The wire shapes
   (`CardPricesResponse`, `CardPriceHistoryResponse`) are designed
   additively so that follow-up extends the same endpoints without
   breaking existing consumers. The Out-of-Scope section of spec.md
   captures this explicitly.
