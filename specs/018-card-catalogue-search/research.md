# Phase 0 Research: Card Catalogue Search

**Spec**: [./spec.md](./spec.md) | **Plan**: [./plan.md](./plan.md)
**Branch**: `018-card-catalogue-search` | **Date**: 2026-05-17

This document resolves every NEEDS CLARIFICATION the plan's Technical Context
opens. Each section follows the Decision / Rationale / Alternatives format and
maps back to the feature requirements it unblocks.

---

## 1. Shared masthead extraction

**Decision**: Lift the in-`BinderHomeView` header bar (lines 82–151 of
`apps/mobile/src/components/binder-home/BinderHomeView.tsx`) into a brand-new
`apps/mobile/src/components/masthead/` four-layer slice and have both
`BinderHomeView` (refactor) and the new `CatalogueView` consume it. The
component owns the crimson surface, the `MY-BINDER` overline, the binder mark,
the italic-serif subtitle, the right-aligned circular `search` + `profile`
buttons, the inline-expand search input with the close-button affordance, and
an optional filter-pill row rendered beneath the masthead row.

The component takes its consumer's per-screen behaviour through props:

| Prop | Type | Used by |
|---|---|---|
| `subtitle` | `string` | both — `"Binder"` (binder) / `"Catalogue"` (catalogue) |
| `searchPlaceholder` | `string` | both — `"Search this binder"` / `"Search the catalogue…"` |
| `isSearchActive` | `boolean` | both |
| `searchQuery` | `string` | both |
| `hasActiveQuery` | `boolean` | both — drives the small gold dot indicator |
| `onSearchOpen` | `() => void` | both |
| `onSearchChange` | `(text: string) => void` | both |
| `onSearchClose` | `() => void` | both |
| `onProfilePress` | `() => void` | both |
| `filterPills` | `ReactNode \| undefined` | catalogue only — slot that renders the active-filter chip row (FR-007) and the inline "Filters" pill that opens the filter sheet |

`filterPills` is a JSX slot rather than a structured prop because the chip
contents are owned by the catalogue's filter-state hook (`useCatalogueFilters`)
and rendering them next to the masthead lets us keep the chip layout
co-located with the catalogue's state shape. The masthead component itself
remains free of catalogue-specific knowledge — it only reserves the row.

**Rationale**: FR-002 explicitly mandates a shared component, FR-022 mandates
the Binder tab adopts it. The wireframe shows the binder masthead and the
catalogue masthead are pixel-identical except for the subtitle, the
placeholder, and the optional filter-pill row. A single component with
prop slots is the minimum-complexity solution that satisfies both FRs
(Principle I, Principle IV).

**Alternatives considered**:

- *Per-screen header bars (status quo).* Rejected — FR-002 mandates a shared
  component; duplicating the masthead between Binder and Catalogue would mean
  every wireframe-level tweak (crimson shade, ring perforation alignment,
  search-pill border) lands twice.
- *Render the masthead inside a layout file at `app/(authenticated)/(tabs)/_layout.tsx`*.
  Rejected — the masthead's content (subtitle, search behaviour, active-query
  dot) is feature-scoped, not navigation-scoped. Layout files MUST NOT host
  feature logic (constitution Principle X Layer rules table).
- *Use `react-navigation`'s `headerTitle` / `headerRight` slots.* Rejected —
  the wireframe has a custom inline-expand search transformation, an overline
  above the title, and a filter-pill row below the title. React Navigation's
  header surface cannot express the row beneath the title without per-screen
  custom headers, which collapses back to today's per-screen approach.

---

## 2. Catalogue paging strategy

**Decision**: Use TanStack Query 5 `useInfiniteQuery` against the existing
`GET /cards/search` endpoint. The mobile hook is `useCatalogueInfiniteQuery`
(new, in `apps/mobile/src/hooks/`), modelled on the existing
`useCardsInfiniteQuery`. The query key is
`['catalogue', 'search', serializedFilters]`; `getNextPageParam` reads
`page < totalPages ? page + 1 : undefined` from the `SearchResult` payload;
`initialPageParam = 1`. Page size is `SLOTS_PER_BINDER_PAGE` (9), passed via
the existing `limit` query parameter on `/cards/search`. Cache policy:
`staleTime: 60_000`, `gcTime: 5 * 60_000` (mirrors the binder query).

Forward navigation pre-fetches one page ahead via `fetchNextPage()`, called
from the catalogue's `useCatalogue` hook when `currentPage === loadedPages - 1`
(i.e. user has reached the last loaded page). Skeleton pockets render while
`isFetchingNextPage` is true (FR-012). Backward navigation is in-cache and
serves immediately (FR-011).

End-of-results detection: when `getNextPageParam` returns `undefined`, the
last page's swipe-forward gesture is a no-op (FR-014). The page indicator
renders `"N of many"` while `hasNextPage` is true and `"N of M"` once the
final page lands (FR-013).

**Rationale**: Reusing the existing `/cards/search` endpoint satisfies the
user's explicit instruction ("infinite query pattern should be used with pages
that follow the current `cards/search/` route"). TanStack `useInfiniteQuery`
already handles dedup, cancellation, retry, and reference-stable cache hits
that the binder's `useCardsInfiniteQuery` proved out (spec 016). Page size of
9 aligns the wire-paging boundary with the visual pocket-grid boundary so
each page response renders exactly one binder page surface.

**Alternatives considered**:

- *Cursor pagination.* Rejected — `/cards/search` already supports
  `page`/`limit` offset paging; the catalogue's filter combinations re-run the
  underlying provider scan from scratch on each filter change, so a stable
  cursor would buy nothing. (Offset paging on a deterministic provider scan
  is the natural fit; cursors are valuable when the underlying ordering
  evolves between requests, which is not the case here.)
- *Single batched fetch with client-side paging.* Rejected — the catalogue
  could return thousands of cards per filter combination; a single fetch
  would saturate memory and break SC-001's 2-second first-page budget.
- *Server-Sent Events / streaming.* Rejected — out of scope; the SearchResult
  shape is already paginated and synchronous.

---

## 3. Filter dimensions on `GET /cards/search` (server-side expansion)

**Decision**: Expand the existing `/cards/search` endpoint to accept the full
filter surface required by FR-005. The current shape accepts `name`, `set`,
`colors`, `cmc_min`, `cmc_max`, `page`, `limit`. The expansion adds:

- `formats=Standard,Modern,Legacy,...` (comma-separated; OR within dimension)
- `super_types=Legendary,Basic,...` (comma-separated; OR within dimension)
- `sub_types=Equipment,Aura,...` (comma-separated; OR within dimension)
- `creature_types=Elf,Goblin,...` (comma-separated; OR within dimension)
- `missing_only=true` (boolean; restricts to printings where the
  authenticated user's `numberOwned = 0`)

The query MUST also drop the existing `MISSING_FILTER` 400 short-circuit when
`missing_only=true` is the only filter — `missing_only` alone is a valid
catalogue browse for an authenticated user.

The expansion lands at three layers:

1. **`packages/core/src/schemas/card.ts`** — extend `SEARCH_QUERYSTRING_SCHEMA`
   with the five new optional fields. Extend `SearchQuery` in
   `packages/core/src/types/card.ts` to mirror.
2. **`apps/server/src/providers/mtgjson/MtgjsonProvider.ts`** — extend the
   `provider.search(query)` adapter to forward the new dimensions to
   `this.sdk.cards.search({ ... })`. The MTGJSON SDK already exposes
   format-legality, super-type, sub-type, and type-line lookups; the adapter
   just plumbs them through.
3. **`apps/server/src/services/cardService.ts`** — extend `searchCards` to
   pass the authenticated `userId` into the search call when `missing_only`
   is true, so the service can post-filter against the user's `cards` rows
   (left-join `cards` table by `printing.uuid = cards.id AND cards.user_id =
   :userId`; keep only rows where `cards.number_owned = 0` or null).

Per FR-021, all queries — with or without explicit format filters — MUST
exclude digital-only printings. The MTGJSON SDK exposes `card.availability`
(e.g. `['paper']`, `['mtgo','arena']`, `['paper','mtgo']`); the provider
adapter MUST filter `card.availability.includes('paper')` server-side before
the response leaves the provider.

**Rationale**: Extending an existing endpoint is strictly simpler than
introducing a new `/catalogue/search` route (Principle I). The MTGJSON SDK
already supports the new filter dimensions; no provider work is required
beyond plumbing. The `missing_only` filter is the only one that needs
per-user awareness, and the service layer (which already has `userId`) is
the right home for that join.

**Alternatives considered**:

- *New `/catalogue/search` endpoint.* Rejected — duplicates the existing
  filter surface, fragments the provider abstraction, and contradicts the
  user's instruction to "follow the current `cards/search/` route".
- *Multiple filter-specific endpoints (`/cards/search/by-format`,
  `/cards/search/by-type`).* Rejected — every endpoint would re-implement
  the AND-across-dimensions semantics from FR-006. One endpoint with a
  composable querystring is the canonical REST shape.

---

## 4. Owned-count model (`numberOwned`) and binder mutations

**Decision**: Extend `CardEntity` with `number_owned INTEGER NOT NULL DEFAULT 1`
and add a migration. The composite primary key `(id, user_id)` is already
correct (FR-023's "one row per `(printing, user)`"), so the migration is
additive — no row consolidation is required. Re-shape the binder write API:

- `POST /cards` (create) → still accepts `{ id, name }` but now treats a
  duplicate `(id, user_id)` as **increment** (`number_owned += 1`) rather
  than a 409. Returns the updated row including `numberOwned`.
- `PATCH /cards/:id` (new) → `{ delta: 1 | -1 }` increments or decrements
  `number_owned`. When the resulting count reaches 0 the row is **deleted**
  (FR-026); the response is 204 with no body. When the resulting count would
  fall below 0 the response is 400.
- `DELETE /cards/:id` — keep existing semantics ("nuke this printing from
  the binder regardless of count") for explicit clear-all flows; not used
  by the inline `−` glyph (which uses `PATCH … {delta:-1}` for the per-tap
  decrement).

Server-side mutations adopt optimistic concurrency at the SQL layer: the
update is a single `UPDATE … SET number_owned = number_owned + :delta WHERE
id = :id AND user_id = :userId RETURNING *`, executed inside the existing
TypeORM transaction. PostgreSQL row-level locking handles concurrent
mutations from the same user.

Mobile-side: a new `useUpdateBinderEntryMutation({ id, delta })` mutation
hook calls `apiClient.patchCard(id, { delta })`. On `onMutate` the hook
optimistically updates two TanStack caches in lock-step:

1. The catalogue search results cache (`['catalogue', 'search', filters]`)
   for every active filter set in the cache.
2. The binder cards cache (`['cards', 'list']`).

Per SC-011 the optimistic update lands within one frame; the server response
reconciles in the background. On `onError` the mutation rolls back both
caches to the snapshotted values and surfaces an inline toast.

**Rationale**: The existing `CardEntity` already keys on `(id, userId)`,
which is exactly the FR-023 shape. Adding `number_owned` is a one-column
additive migration with no row migration. Re-using `PATCH` with a `{delta}`
body keeps the binder write surface narrow (three verbs total) and lets the
existing handler chain — including `request.identity` and the 401/403
preHandler — keep working unchanged.

Optimistic updates on TanStack are the canonical pattern for this UX
(matched-pair `onMutate` + `onError` + `onSettled` with cache snapshotting);
this is the same shape TanStack's own docs use for incrementable counters.

**Alternatives considered**:

- *Replace `(id, user_id)` PK with a synthetic `binder_entry_id` PK.*
  Rejected — adds a join for every catalogue query that needs to know "did
  the user own this printing", and forces a uniqueness constraint that the
  composite PK already enforces.
- *Track each acquisition as a separate row (`acquired_at`-keyed).*
  Rejected — FR-023 explicitly mandates one row per `(printing, user)`
  carrying `numberOwned`; the spec was clarified on this point.
- *Surface `+`/`−` via fresh POST/DELETE pairs.* Rejected — POST-on-existing
  ambiguity (409 vs 200) and DELETE-decrements-one ambiguity (vs nuke-all)
  are worse than the explicit `PATCH … {delta}` shape.

---

## 5. Bottom sheet library

**Decision**: Adopt **`@gorhom/bottom-sheet@^5`** (the v5 release line, which
supports React Native 0.81 + Reanimated 4). Used for both the filter sheet
and the card detail sheet. The library has zero runtime deps beyond
`react-native-reanimated` and `react-native-gesture-handler`, both of which
are already installed at Expo SDK 54-pinned versions.

The sheet wrapper component is a thin local re-export
(`apps/mobile/src/components/sheet/Sheet.tsx`) that:

- Pre-configures the backdrop (`BottomSheetBackdrop` with `disappearsOnIndex={-1}`)
- Wires the swipe-down dismiss gesture (FR-020)
- Forwards `onDismiss` and `snapPoints` props
- Renders the gold-bordered grabber matching the wireframe

A `useSheetController` hook returns `{ ref, present, dismiss, isOpen }` so
consumers don't manage the underlying `BottomSheetModalRef` directly.

**Rationale**: Building a bottom sheet from scratch with Animated/Reanimated
+ PanGestureHandler is non-trivial (snap points, velocity-aware dismissal,
backdrop scrim, scroll-inside-sheet behaviour). `@gorhom/bottom-sheet` is
the de-facto React Native bottom-sheet library — 7k stars, actively
maintained, recommended by Reanimated docs. Adoption is a single
`pnpm add` and matches FR-016's "slides up over the canvas" and FR-020's
"swipe down past a threshold" specification verbatim.

**Alternatives considered**:

- *Roll our own with `react-native-reanimated` + `react-native-gesture-handler`.*
  Rejected — introduces ~300 lines of gesture-handling code that
  `@gorhom/bottom-sheet` already gets right (and tests against every RN
  version). Cost (one well-known dep) versus benefit (substantial bespoke
  code) lands on the dep.
- *`react-native-modal`.* Rejected — a modal, not a bottom sheet; lacks
  snap points and the swipe-down dismiss with velocity threshold.
- *Native `Modal` from `react-native` + custom animation.* Rejected — no
  built-in swipe-down handling, and the cross-platform animation behaviour
  is uneven.

Principle XI: `@gorhom/bottom-sheet@^5` is the registry-current stable
release (5.x). Selection lands as a "no off-stable choice" entry in the
Dependency Currency Check table.

---

## 6. 30-day price-trend chart rendering

**Decision**: Render the chart with **`react-native-svg` directly** (no new
chart library). `react-native-svg@15.12.1` is already installed (it backs
`@expo/vector-icons`). The chart implementation lives at
`apps/mobile/src/components/card-detail-sheet/PriceTrendChart.tsx` as a
single pure-render component:

- Axes drawn with `<Line />` (1px, 18% black).
- Gridlines optional; the wireframe shows only the axis lines.
- One `<Path />` per in-scope source (Card Kingdom / TCG Player; MTG Goldfish is deferred per the spec's 2026-05-18 Clarifications entry),
  drawn from the 30-day series as `M x1 y1 L x2 y2 …`.
- Y-axis range computed from `min(all) * 0.95` to `max(all) * 1.05`.
- Missing observations render as gaps in the line (`M`-segments restart).
- Legend rendered with native `<Text />` + small swatch boxes (not in SVG).

Total surface: ~120 lines of view code, ~40 lines of math (axis scaling +
path string assembly) — co-located inside the card-detail-sheet feature
directory, no new shared utility.

**Rationale**: The chart is small (140px tall × 320px wide per wireframe),
exposes three lines with no interactivity (no tooltips, no zoom, no scrub
gesture), and uses a fixed 30-day x-axis. Every charting library on RN
(`victory-native`, `react-native-svg-charts`, `react-native-gifted-charts`)
would import 200+ KB of code to render what `react-native-svg` can express
in 40 lines of math. Principle I (Simplicity First) prefers the direct
path. Principle XI (Dependency Currency) discourages adding a new dependency
when an existing one (already pinned, already tested) covers the use case.

**Alternatives considered**:

- *`victory-native@^41`.* Rejected — adds Skia (`@shopify/react-native-skia`)
  as a peer dep, which is a much heavier runtime dependency than needed.
- *`react-native-svg-charts`.* Rejected — last published in 2020, unmaintained,
  peer-deps an older `react-native-svg` major.
- *`react-native-gifted-charts`.* Rejected — opinionated styling that fights
  the wireframe's specific axis/legend treatment; we would end up overriding
  most of the surface anyway.

---

## 7. Price observation data path

**Decision**: Read price data directly from the **MTGJSON SDK** already
running inside `apps/server` (the SDK that backs the catalogue browse and
the card-image URLs). The SDK ships an `sdk.prices` query layer with the
exact two operations the detail sheet needs:

```ts
sdk.prices.today  (uuid, { provider, finish: 'normal', priceType: 'retail' })
            // → latest observation (one row per format/provider)
sdk.prices.history(uuid, { provider, finish: 'normal', priceType: 'retail',
                           dateFrom, dateTo })
            // → date-keyed price points within the window
```

The data is already part of the SDK's parquet cache on EFS (the same cache
the catalogue search reads from) — no new database table, no new
migration, no ingestion job, no third-party scraping. MTGJSON publishes
this dataset under the `AllPrices.json` feed (see
https://mtgjson.com/data-models/price/price-list/), and the SDK exposes
it via the typed `PriceQuery` API.

**Mapping the spec's price sources to MTGJSON's price providers**
(per the spec's 2026-05-18 Clarifications entry, MTG Goldfish is
deferred to a follow-up specification; this spec ships two sources):

| Spec source (FR-017) | MTGJSON provider key | Notes |
|---|---|---|
| Card Kingdom | `cardkingdom` | Direct match. |
| TCG Player   | `tcgplayer`   | Direct match. |

MTGJSON's full retail provider list is `cardhoarder` (MTGO only),
`cardkingdom`, `cardmarket`, `cardsphere`, and `tcgplayer`. Paper-only
(FR-021) means dropping `cardhoarder`. The two providers above are
the canonical North-American retail signals that MTGJSON publishes;
adopting them directly satisfies the revised two-source FR-017 with
zero substitution shenanigans.

**MTG Goldfish deferral**: the original input named MTG Goldfish as a
third price source, but MTGJSON does not publish MTG Goldfish data.
Per the spec's 2026-05-18 Clarifications entry, MTG Goldfish is
deferred to a follow-up specification — adding it requires bespoke
ingestion work (third-party data acquisition, scheduling, licensing
review) that does not belong in a catalogue-UX spec. The detail-sheet
wire shapes (`CardPricesResponse`, `CardPriceHistoryResponse`) are
designed additively so a future spec can add a third `mtgGoldfish`
slot without breaking existing consumers.

**Implementation shape**:

- **Provider interface extension**: `CardProvider` (in
  `apps/server/src/providers/interface.ts`) gains two new methods so the
  layered architecture (Principle VI) stays intact:

  ```ts
  getPrices(uuid: string):
    Promise<CardPricesResponse>;   // shape per data-model §2.4
  getPriceHistory(uuid: string, days: number):
    Promise<CardPriceHistoryResponse>;
  ```

- **`MtgjsonProvider`** implements both methods by calling
  `sdk.prices.today` and `sdk.prices.history` once per in-scope
  provider key (two calls per request — `cardkingdom`, `tcgplayer` —
  fanned out with `Promise.all`). Each call is parameterised
  `{ finish: 'normal', priceType: 'retail' }`. The provider converts
  the SDK's raw `{ date: amount }` row shape into the wire shapes
  (`PriceQuote` for `today`, `PricePoint[]` for `history`) defined in
  `@my-binder/core`.

- **`priceService`** (new, thin) wraps the provider calls with the same
  `ProviderUnavailableError` rewriting `cardService` already uses, so
  the route handler can map errors consistently to 503.

- **Routes** (`GET /cards/:id/prices`, `GET /cards/:id/prices/history`)
  call `priceService` and serialise the responses. No repository, no
  ORM entity, no migration.

- **404 vs empty**: when the provider returns no observations for a
  source (e.g. the printing has no TCG Player price ever), the response
  carries `null` for that source slot (per FR-019); the endpoint NEVER
  returns 404 for "no prices". 404 is reserved for "no such printing",
  matching the existing `getCardImagesById` semantics.

**Rationale**: This is the cleanest mapping of the user's directive
("use the MTGJSON sdk for that data") onto the existing architecture.
No new persistence layer, no new ingestion concern, no new operational
surface to monitor. The SDK already has the data and exposes a typed
API for it; the provider abstraction is the right place to consume it
(Principle VI). The two-source scope respects the 2026-05-18
clarification that defers MTG Goldfish — additive wire shapes mean the
follow-up spec can extend the same endpoints without breaking
consumers.

**Alternatives considered**:

- *Build our own `price_observations` table + ingestion job.* Rejected
  — duplicates what MTGJSON already publishes, doubles operational
  surface, and contradicts the user's explicit direction to "use the
  MTGJSON sdk for that data."
- *Substitute Cardmarket or Cardsphere for MTG Goldfish.* Rejected
  per the 2026-05-18 clarification — silently swapping a price source
  the spec named explicitly would mislead users; the right answer is
  to defer MTG Goldfish to a dedicated spec and ship two sources here.
- *Embed live scrapers for Card Kingdom / TCG Player in the request
  path.* Rejected — MTGJSON already aggregates them; doing it
  ourselves is duplicate work plus rate-limit / ToS exposure.
- *Cache MTGJSON price responses in a local table.* Rejected as
  premature optimisation — the SDK already loads from a local parquet
  cache on EFS, so an additional in-process cache layer would buy
  nothing measurable.

---

## 8. Catalogue ↔ binder linkage for the owned-count glyph

**Decision**: The catalogue's query result MUST carry, per printing, the
authenticated user's `numberOwned` for that printing. The `/cards/search`
response is extended so each `CardRecord` carries an optional
`numberOwned?: number` field, populated server-side by left-joining the
`cards` table on `cards.id = printing.uuid AND cards.user_id = :userId`
inside `cardService.searchCards`. Missing values surface as `0` (the field
defaults to `0` mobile-side, not `undefined`, to keep glyph-visibility
arithmetic from branching on undefined).

Mobile-side, the owned-count glyph reads `card.numberOwned` directly from
each cell — no extra lookup, no extra request, no cross-cache reconciliation.
The optimistic `useUpdateBinderEntryMutation` (decision 4) mutates the
`numberOwned` field directly inside the cached catalogue page so the glyph
updates within one frame (SC-011).

For the **Binder** tab the existing `/cards` endpoint is similarly extended
to populate `numberOwned` per row (the table already keys on `(id, user_id)`
so the value is local to the row — no join required, just an additional
`SELECT` column).

**Rationale**: Bundling `numberOwned` into the search response is one extra
column on a join the service is making anyway when `missing_only=true` is
true; making it always present trades a trivial DB cost (one column) for a
significant client-side simplicity gain (no second query, no cache
correlation logic). Mobile-side, "this printing's count is part of this
printing's payload" is the simplest mental model for cache invalidation —
the catalogue cache entry and the binder cache entry are both `Card`
records carrying the same `numberOwned`, and the mutation hook updates both
in `onMutate` via a single helper.

**Alternatives considered**:

- *Separate `/binder/owned-counts?ids=...` endpoint queried after each
  catalogue page lands.* Rejected — doubles request count on cold cache,
  forces the catalogue page to render twice (once with no glyph, then again
  once the count lands), violates SC-011.
- *Single `/binder/owned-counts` query cached globally and joined in the
  selector.* Rejected — the client-side join is recomputed on every
  mutation reconciliation and adds a memoisation surface the catalogue's
  hook doesn't otherwise need.

---

## 9. Defer-and-refresh affordance (FR-031)

**Decision**: Implement the "results out-of-date — refresh" affordance as a
piece of state inside `useCatalogue` keyed off the catalogue's
`useUpdateBinderEntryMutation` callback. When a mutation's
`onSettled` fires AND any filter dimension is active (i.e. `Missing only` is
ON, or any chip filter is selected, or the search query is non-empty), the
hook sets `resultsAreStale = true`. The view renders the gold-bordered
"results out-of-date — refresh" pill (per wireframe) when `resultsAreStale`
is true.

Tapping the pill triggers `queryClient.invalidateQueries({ queryKey:
['catalogue', 'search'] })` and clears the stale flag. Navigating away from
the Catalogue tab and back also clears the flag (Expo Router's
`useFocusEffect` hooked into the catalogue screen) which re-fetches the
active query.

Filter mutations (changing a filter value, clearing filters, typing in the
search input) invalidate the query immediately and skip the stale flag —
the defer rule applies ONLY to ownership mutations from `+` / `−` / stepper
actions per FR-031.

**Rationale**: The wireframe shows this affordance is a single banner with a
single tap target — the simplest implementation that satisfies FR-031 is a
boolean flag in the catalogue hook plus a cache-invalidation call on tap.
TanStack already exposes `invalidateQueries` for this exact use case; no
new abstraction needed.

**Alternatives considered**:

- *Animate the pocket out of the result set on mutation.* Rejected — the
  spec explicitly says "the just-added pocket stays put" until the user
  taps refresh or returns to the tab.
- *Schedule a debounced auto-refetch after the last mutation in a burst.*
  Rejected — would defeat the "preserve scroll anchor during add-a-bunch
  workflow" use case the spec was clarified to protect.

---

## 10. Test-data fixtures for the catalogue

**Decision**: Use the offline-mode MTGJSON SDK cache already living at
`apps/server/data/mtgjson-cache/` as the source of truth for catalogue
tests (Principle III's Server route test conventions, rule #3). The
canonical printings already cited in `MtgjsonProvider.test.ts` (M11
Lightning Bolt at `6ca7af0b-4b6a-59ba-90be-6da4f62bcff1`) are enough to
exercise every catalogue filter dimension. The price-history fixture loader
(decision 7) is invoked only by route tests that hit the prices endpoints.

Mobile-side, the new TanStack hooks (`useCatalogueInfiniteQuery`,
`useCardPricesQuery`, `useCardPriceHistoryQuery`,
`useUpdateBinderEntryMutation`) follow the existing test pattern from
`useCardsInfiniteQuery.test.ts` and `useCardImagesQuery.test.ts` —
`QueryClientProvider` per test, `apiClient` spied via the existing
`jest.setup.ts` defaults.

**Rationale**: Reusing the existing offline-mode fixture means no new
parquet data, no new fixture seeds, no test-only provider; the catalogue
filters are exercised against the same printings the binder tests already
exercise. This keeps the test surface uniform across specs 016, 017, 018.

**Alternatives considered**:

- *Fabricate a test-only MTGJSON dataset.* Rejected — duplicates
  `apps/server/data/mtgjson-cache/` for no behavioural gain; violates
  Principle III rule #3 (real provider in offline mode).
- *Mock `MtgjsonProvider.search` directly in tests.* Rejected — explicitly
  prohibited by Principle III rules #1 + #3 for server route tests.

---

## Summary of resolved unknowns

| # | Unknown | Decision |
|---|---|---|
| 1 | Where does the shared masthead live? | New `apps/mobile/src/components/masthead/` four-layer slice; both Binder and Catalogue consume it. |
| 2 | How does the catalogue page? | TanStack `useInfiniteQuery` against `GET /cards/search` with `limit=9`. |
| 3 | What filters does `/cards/search` need? | Add `formats`, `super_types`, `sub_types`, `creature_types`, `missing_only`; mandate paper-only at provider layer. |
| 4 | How is `numberOwned` stored and mutated? | One column on `CardEntity`; new `PATCH /cards/:id` with `{delta}` body. |
| 5 | What bottom-sheet library? | `@gorhom/bottom-sheet@^5`. |
| 6 | What chart library? | `react-native-svg` directly — no new dep. |
| 7 | Where does price data come from? | MTGJSON SDK (`sdk.prices.today` + `sdk.prices.history`) via the provider abstraction; provider keys `cardkingdom` + `tcgplayer`, finish `normal`, priceType `retail`. Two sources, additive wire shapes. MTG Goldfish deferred to a follow-up specification per spec's 2026-05-18 Clarifications entry. |
| 8 | How does the catalogue know what's owned? | `numberOwned` joined into `/cards/search` response per printing. |
| 9 | How is the defer-refresh affordance built? | Boolean flag in `useCatalogue` set by mutation `onSettled`; tap invalidates the catalogue query. |
| 10 | What test data? | Existing offline-mode MTGJSON SDK cache; canonical M11 Lightning Bolt printing. |

All NEEDS CLARIFICATION items resolved. Plan can proceed to Phase 1
(`data-model.md`, `contracts/`, `quickstart.md`).
