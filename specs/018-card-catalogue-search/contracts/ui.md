# Phase 1 Contracts: Mobile UI surfaces

**Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md) | **API**: [./api.md](./api.md)

This document captures every mobile UI surface introduced or modified by
spec 018: the shared `Masthead` component, the `Catalogue` feature slice,
the `CardDetailSheet` feature slice, the `CatalogueFilterSheet` feature
slice, and the cross-feature TanStack hooks that feed them.

Every contract follows Principle X — Screen → Container → Hook → View, FC
declaration rule, Style co-location rule, Hook return-value memoisation
rule, Data-fetching hook composition rule (v1.26.0), and State locality
rule.

---

## 1. Screens (Expo Router route files)

### 1.1 `apps/mobile/app/(authenticated)/(tabs)/search.tsx` (rewrite)

Current state: renders `<ComingSoonContainer />` (spec 002 stub).
After 018: renders `<CatalogueContainer />` as the canonical one-line shell.

```tsx
import type { FC } from 'react';
import { CatalogueContainer } from '@src/components/catalogue/CatalogueContainer';

const Search: FC = () => <CatalogueContainer />;
export default Search;
```

### 1.2 `apps/mobile/app/(authenticated)/(tabs)/_layout.tsx` (modify)

Adds `headerShown: false` to the Search tab's `<Tabs.Screen />` options so
the in-feature `Masthead` renders edge-to-edge (matching the Binder tab).

### 1.3 `apps/mobile/app/(authenticated)/(tabs)/binder.tsx` (unchanged)

The binder screen file stays the canonical `<BinderHomeContainer />` shell;
its internal `<BinderHomeView />` is refactored (see §3.2) but the route
file itself is untouched.

---

## 2. Masthead component (NEW — extracted, shared)

**Directory**: `apps/mobile/src/components/masthead/`

```
masthead/
├── Masthead.tsx              ← pure JSX; renders crimson header bar
├── Masthead.theme.ts         ← useStyles hook (Style co-location rule)
├── Masthead.test.tsx         ← view test (rule v1.24.0)
└── types.ts                  ← MastheadProps (data-model §5)
```

There is no `useMasthead.ts` or `MastheadContainer.tsx` — the masthead is
a **pure presentation component** consuming props supplied by its
consumer's hook. Adding a hook layer would force every consumer through a
container indirection that adds no value (the masthead has no
internal state and no side effects).

### 2.1 Props (re-stated from data-model §5)

```ts
export type MastheadProps = {
  subtitle: string;
  searchPlaceholder: string;
  isSearchActive: boolean;
  searchQuery: string;
  hasActiveQuery: boolean;
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClose: () => void;
  onProfilePress: () => void;
  filterPills?: ReactNode;
};
```

### 2.2 Render contract

When `isSearchActive === false`:

- Crimson background (Colors.dark.background)
- Binder mark icon (existing `IconSmall`)
- Overline `MY-BINDER` (Spacing-uppercase, gold accent)
- Subtitle (italic-serif, rose-200, sized per `Type.subtitleItalic`)
- Right-aligned action group: `[Search] [Profile]` circular buttons
- Filter-pill row (slot) rendered beneath the masthead row when
  `filterPills` is provided AND non-empty

When `isSearchActive === true`:

- Crimson background unchanged
- Masthead text + icon collapse
- Inline `<TextInput>` with the gold-bordered pill treatment, leading
  search glyph, trailing close button
- The action group hides
- Active-query dot indicator appears when `hasActiveQuery === true`
  (small gold dot inside the input, drives FR-007 + FR-008 in concert
  with the filter-pill slot)

### 2.3 Accessibility

| Element | Role | Label |
|---|---|---|
| Search button | `button` | `"Search the binder"` (binder) / `"Search the catalogue"` (catalogue) — derived from `subtitle` prop |
| Profile button | `button` | `"Open profile"` |
| Search input | `text` | `"Search this binder"` (binder) / `"Search the catalogue"` (catalogue) — derived from `searchPlaceholder` prop |
| Close button | `button` | `"Close search"` |
| Active-query dot | testID-only | `"search-active-indicator"` |

The accessibility labels are derived from `subtitle` so the same component
serves both surfaces without conditional accessibility text.

---

## 3. Catalogue feature slice (NEW)

**Directory**: `apps/mobile/src/components/catalogue/`

```
catalogue/
├── CatalogueContainer.tsx     ← destructures useCatalogue, passes named props
├── useCatalogue.ts            ← feature hook (filter state, mutations, defer-flag)
├── CatalogueView.tsx          ← pure JSX (masthead + canvas + grid + pager + sheets)
├── CatalogueView.theme.ts     ← useStyles
├── CatalogueView.test.tsx
├── useCatalogue.test.ts
├── CatalogueContainer.test.tsx
└── types.ts                   ← CatalogueFilterSet, CataloguePage, CatalogueViewProps, UseCatalogueOptions
```

### 3.1 `useCatalogue` (hook contract)

```ts
import type { Pick } from 'react';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';

import type { CardRecord } from '@my-binder/core';
import type { ApiError } from '@src/services/api/ApiError';

import type {
  CatalogueViewProps,
  UseCatalogueOptions,
} from './types';

// `UseCatalogueOptions` is empty today (no parameters needed). It is
// declared as a named type so future options (e.g. an initial filter
// override) can land without changing the call signature, per
// Principle X v1.26.0 rule #6.
export type UseCatalogueOptions = Record<string, never>;

export type UseCatalogueResult = CatalogueViewProps;
```

`useCatalogue` composes:

| Composed source | Purpose |
|---|---|
| `useCatalogueInfiniteQuery(filters)` | TanStack `useInfiniteQuery` over `GET /cards/search`; page size = `SLOTS_PER_BINDER_PAGE` |
| `useCardPricesQuery(printingId)` | lazy — only enabled when the detail sheet is open for a printing |
| `useCardPriceHistoryQuery(printingId, 30)` | lazy — same |
| `useUpdateBinderEntryMutation()` | optimistic add/remove via `POST /cards` and `PATCH /cards/:id` |
| `useFilterReducer(initial = EMPTY_FILTER_SET)` | feature-local reducer for the filter state (single-consumer; Principle X State locality) |
| `useRouter()` | profile navigation |

All non-primitive return values are memoised with `useMemo` / `useCallback`
per Principle X v1.16.0 (Hook return-value memoisation rule).

### 3.2 Binder feature refactor

`apps/mobile/src/components/binder-home/BinderHomeView.tsx` is refactored:

- The inline header bar (lines 82–151) is **removed** and replaced with
  `<Masthead {...mastheadProps} />`.
- `useBinderHome` exposes the masthead-shaped props (`subtitle: 'Binder'`,
  `searchPlaceholder: 'Search this binder'`, plus the existing search
  callbacks) so `BinderHomeContainer` can hand them to `<Masthead />`.
- Existing search behaviour, in-binder filter behaviour, and Profile
  shortcut are unchanged at the user level (FR-022).
- `numberOwned` is now read from `card.numberOwned` on every binder
  pocket; the owned-count glyph renders when `numberOwned >= 2`
  (FR-024). The `−` glyph-button is added to each pocket and wired to
  `useUpdateBinderEntryMutation({ delta: -1 })`.

The existing tests (`BinderHomeView.test.tsx`, `useBinderHome.test.ts`)
are updated to (a) assert the masthead is rendered as a child component
not as inline JSX, (b) cover the new glyph + `−` interactions.

### 3.3 `CatalogueView` render contract

The view mirrors the wireframe at `specs/018-card-catalogue-search/design/wireframe.html`:

```
┌─────────────────────────────────────────────┐  ← status bar (RN safe area)
│ <Masthead subtitle="Catalogue" … />          │  ← MUST be the same component as the Binder uses
│   [active-filter pills…] [⌅ Filters]         │  ← filterPills slot
├─────────────────────────────────────────────┤
│ <SummaryCaption>18+ MATCHES · 9 PER PAGE</> │
│ ┌───────────────────────────────────────┐   │
│ │  ┌──┐ ┌──┐ ┌──┐                       │   │  ← binder page surface
│ │  │  │ │  │ │  │  (3x3 grid)            │   │     ring perforations
│ │  └──┘ └──┘ └──┘                       │   │
│ │  ...                                  │   │
│ └───────────────────────────────────────┘   │
│            1 of many                          │  ← italic-serif "N of M"
│   [⟲ Results out-of-date — tap to refresh]  │  ← FR-031, conditional
├─────────────────────────────────────────────┤
│ [Binder] [Search*] [Scan] [Profile]          │  ← bottom tab bar (* = current)
└─────────────────────────────────────────────┘

  When tapping a pocket → CardDetailSheet slides up from the bottom
  When tapping ⌅ Filters → CatalogueFilterSheet slides up from the bottom
```

Pockets render `<Card id={card.id} footprint="pocket" />` (the spec 017
component, unchanged). The owned-count glyph and `+` glyph-button are
NEW overlays positioned absolutely within the pocket:

- Owned-count glyph: top-right, gold pill with `×N` (FR-024). Visible
  when `numberOwned >= 1` on the Catalogue.
- `+` glyph-button: bottom-right, dark with gold border (FR-025).
  `hitSlop: 8` and `pointerEvents: 'box-only'` so the wrapping
  `Pressable` does not absorb the swipe gesture (FR-027 / SC-013).

Skeleton pockets render the shimmer shown in the wireframe
(`background-size: 200% 100%` shimmer at 1.4s linear infinite) — built
with `react-native-reanimated` `withRepeat` per the existing pattern.

Per the swipe-gesture-only requirement (FR-010 + 2026-05-17 Clarification),
no flanking arrow buttons are rendered around the page indicator. The
indicator is the only pager UI element. The static wireframe's
"swipe →" / "← swipe" pills are demo-only and MUST NOT ship.

### 3.4 `CatalogueViewProps` test surface

Test IDs for view-level assertions:

| testID | Purpose |
|---|---|
| `catalogue-root` | the screen root |
| `catalogue-summary-caption` | the summary caption text |
| `catalogue-binder-page` | the binder page surface |
| `catalogue-page-N` | each rendered page in the pager (N = 1-based) |
| `catalogue-page-indicator` | the italic "N of M" text |
| `catalogue-skeleton-pocket` | each skeleton pocket while a page is loading |
| `catalogue-empty-pocket` | each empty pocket on a partial last page |
| `catalogue-pocket-action-add` | the `+` glyph-button on each populated pocket |
| `catalogue-owned-glyph` | the `×N` owned-count glyph |
| `catalogue-refresh-hint` | the "results out-of-date" banner (FR-031) |
| `catalogue-empty-state` | the "no cards match these filters" pane (FR-015) |
| `catalogue-empty-state-clear` | the "clear filters" affordance inside the empty state |

The view tests render `<CatalogueViewWithDefaults>` per the v1.24.0
view-test convention.

---

## 4. Catalogue filter sheet (NEW)

**Directory**: `apps/mobile/src/components/catalogue-filter-sheet/`

```
catalogue-filter-sheet/
├── CatalogueFilterSheetContainer.tsx
├── useCatalogueFilterSheet.ts
├── CatalogueFilterSheetView.tsx
├── CatalogueFilterSheetView.theme.ts
├── CatalogueFilterSheetView.test.tsx
└── types.ts
```

### 4.1 Hook contract

```ts
export type UseCatalogueFilterSheetOptions = {
  open: boolean;
  draft: CatalogueFilterSet;          // sheet edits a working draft
  onApply: (next: CatalogueFilterSet) => void;
  onClear: () => void;                // resets working draft to EMPTY
  onClose: () => void;                // dismiss without applying
};
```

The sheet maintains a **local working draft** of the filter set so the
user can twiddle chips without re-running the catalogue query on every
tap. The draft commits to the catalogue's filter state only when
`onApply` fires (FR-008 — "Apply" button is the commit gate).

### 4.2 View render contract

Mirrors the wireframe's `#filterSheet`:

- Sheet header: italic-serif title "Refine catalogue" + close `×` button
- Toggle row: "Missing only" + helper text + iOS-style toggle (FR-005)
- For each filter dimension: section label (uppercase letter-spaced) +
  chip row
  - **Set**: chips populated from the loaded catalogue's distinct sets;
    "+ more…" chip surfaces a (deferred) full-list picker
  - **Format legality**: Standard / Modern / Legacy / Vintage / Commander
    / Pauper (FR-005)
  - **Card super type**: Legendary / Basic / Snow / World
  - **Card sub type**: Equipment / Aura / Saga / Vehicle
  - **Creature type**: Elf / Goblin / Wizard / Dragon / Zombie / "+ more…"
  - **CMC range**: two numeric inputs (`cmcMin`, `cmcMax`)
  - **Colour identity**: six color-chip swatches (W/U/B/R/G/C)
- Sheet footer: ghost "Clear all" button + primary "Apply" button

Selected chips render in crimson with white text (`.chip.selected` from
the wireframe). The colour-identity chips show a gold ring when selected
(`box-shadow: 0 0 0 3px var(--gold-500)`).

### 4.3 Bottom-sheet behaviour

Implemented with `@gorhom/bottom-sheet@^5` (research §5). Snap points:
`['78%']`. Swipe-down past 30% threshold OR tap on the close button OR
tap on the scrim dismisses (without applying). Tapping "Apply" commits
the draft and closes.

---

## 5. Card detail sheet (NEW — shared between Catalogue and Binder)

**Directory**: `apps/mobile/src/components/card-detail-sheet/`

```
card-detail-sheet/
├── CardDetailSheetContainer.tsx
├── useCardDetailSheet.ts
├── CardDetailSheetView.tsx
├── CardDetailSheetView.theme.ts
├── PriceTrendChart.tsx                ← pure-render react-native-svg chart (research §6)
├── PriceTrendChart.theme.ts
├── PriceTrendChart.test.tsx
├── CardDetailSheetView.test.tsx
├── useCardDetailSheet.test.ts
└── types.ts
```

### 5.1 Hook contract

```ts
export type UseCardDetailSheetOptions = {
  printingId: string | null;          // null when no sheet is open
  surface: 'binder' | 'catalogue';    // drives stepper hint text
  onClose: () => void;                // parent owns sheet visibility
};
```

`useCardDetailSheet` composes:

- `useCardImagesQuery(printingId)` — reuses the spec 017 hook
- `useCardPricesQuery(printingId)` — NEW (cross-feature, in `src/hooks/`)
- `useCardPriceHistoryQuery(printingId, 30)` — NEW
- `useCardDetailsQuery(printingId)` — NEW or existing `GET /cards/:id`
- `useUpdateBinderEntryMutation()` — NEW (shared with catalogue)
- `useBinderEntry(printingId)` — derived selector exposing the local
  `numberOwned` (read from catalogue cache OR binder cache, whichever
  carries the printing)

All queries are gated on `printingId !== null` via `enabled`.

### 5.2 View render contract

Mirrors the wireframe's `#detailSheet`:

```
┌─ Bottom sheet ────────────────────────┐
│   [grabber]                            │
│   Counterspell                    [×]  │  ← italic-serif name
│  ┌────┐  Counterspell (italic)         │
│  │    │  M21 · M21                     │
│  │art │  Instant                       │
│  └────┘  An illustrative oracle blurb… │
├────────────────────────────────────────┤
│   In your binder                       │
│   Catalogue → adds this printing       │
│                          [−] N [+]     │  ← stepper (FR-028)
├────────────────────────────────────────┤
│   PRICES · PHYSICAL PRINTING ONLY      │  ← FR-017
│   ● Card Kingdom            $13.78     │
│   ● TCG Player              $13.11     │
├────────────────────────────────────────┤
│   30-DAY PRICE TREND                   │  ← FR-018
│   $16 ┐╲       ╱╲                       │
│       │  ╲   ╱     ╲                    │
│   $0  └────────────────                 │
│         30d ago            today        │
│   ● Card Kingdom  ● TCG Player          │  ← legend
└────────────────────────────────────────┘
```

Stepper:

- `−` disabled when `numberOwned <= 0` (visually shown via `opacity:
  0.3, cursor: not-allowed` per wireframe).
- `+` always enabled.
- The count between the buttons is the italic-serif `numberOwned` value.

Prices section:

- Two rows (Card Kingdom + TCG Player; MTG Goldfish deferred per the
  spec's 2026-05-18 Clarifications entry). Each row has a colour
  swatch + source name + formatted price.
- Missing observation renders `—` (FR-019) with `font-style: italic` and
  `color: text-muted`.

Chart:

- `<PriceTrendChart cardKingdom={…} tcgPlayer={…} />`
- `react-native-svg` with axes, gridlines optional, one path per
  in-scope source, legend below (per research §6).
- When both series are empty: render the axes only with the centred
  text annotation "no recent price data" (FR-019).

### 5.3 Lifecycle

| Event | Effect |
|---|---|
| Mounted with `printingId = null` | renders nothing |
| `printingId` transitions non-null → starts the three queries; sheet renders skeleton state |
| Image, prices, history land | sheet renders fully |
| User taps `+` or `−` | `useUpdateBinderEntryMutation` fires; optimistic glyph + stepper update; the underlying queries are untouched |
| User taps the close `×`, taps the scrim, or swipes down past 30% | `onClose()` fires; parent sets `printingId = null` |

---

## 6. New cross-feature TanStack hooks

**Directory**: `apps/mobile/src/hooks/`

| Hook | File | Wraps |
|---|---|---|
| `useCatalogueInfiniteQuery(filters)` | `useCatalogueInfiniteQuery.ts` (new) | `apiClient.searchCards` via `useInfiniteQuery` |
| `useCardPricesQuery(id)` | `useCardPricesQuery.ts` (new) | `apiClient.getCardPrices` via `useQuery` |
| `useCardPriceHistoryQuery(id, days)` | `useCardPriceHistoryQuery.ts` (new) | `apiClient.getCardPriceHistory` via `useQuery` |
| `useCardDetailsQuery(id)` | `useCardDetailsQuery.ts` (new) | `apiClient.getCard(id)` via `useQuery` |
| `useUpdateBinderEntryMutation()` | `useUpdateBinderEntryMutation.ts` (new) | `apiClient.upsertCard` and `apiClient.patchCard` via `useMutation` with optimistic update + cache reconciliation |

Each hook exports its `UseXxxQueryResult` / `UseXxxMutationResult` type
alias so feature view-props can `Pick` from it (Principle X v1.26.0
rule #5).

### 6.1 `useUpdateBinderEntryMutation` — optimistic mutation contract

```ts
type UpdateBinderEntryVariables = {
  printingId: string;
  printingName: string;
  delta: 1 | -1;
};

type UpdateBinderEntryContext = {
  // Snapshots taken in onMutate for rollback in onError.
  catalogueQueries: Array<{ key: QueryKey; data: InfiniteData<SearchResult> | undefined }>;
  binderQuery: { key: QueryKey; data: InfiniteData<CardList> | undefined };
};
```

On `onMutate`:

1. `cancelQueries({ predicate: q => q.queryKey[0] === 'catalogue' || q.queryKey[0] === 'cards' })`
2. Snapshot every `['catalogue', 'search', …]` cache entry and the
   `['cards', 'list']` cache entry into the context.
3. Optimistically write `numberOwned` += delta on every match for
   `printingId` across both caches. If the new count is 0, remove the
   binder cache entry; on the catalogue, leave the row in place with
   `numberOwned: 0` (FR-031 defer rule).
4. Return the context.

On `onError`:

1. Restore every snapshotted cache entry.
2. Surface an inline toast ("Couldn't update binder — tap to retry").

On `onSettled`:

1. `invalidateQueries({ queryKey: ['cards', 'list'] })` to reconcile
   `numberOwned`, `updatedAt`, and the canonical row count.
2. Do **not** invalidate `['catalogue', 'search', …]` — the defer rule
   (FR-031) requires the catalogue's stale-flag mechanism to drive the
   refresh. The mutation hook publishes a "binderMutationLanded" signal
   that `useCatalogue` consumes to set `resultsAreStale = true`.

---

## 7. Summary of mobile additions

| Area | Path | Status |
|---|---|---|
| Screen | `apps/mobile/app/(authenticated)/(tabs)/search.tsx` | MODIFY — render `<CatalogueContainer />` |
| Screen | `apps/mobile/app/(authenticated)/(tabs)/_layout.tsx` | MODIFY — `headerShown: false` for Search tab |
| Component | `apps/mobile/src/components/masthead/` | NEW — shared masthead (FR-002) |
| Component | `apps/mobile/src/components/binder-home/` | MODIFY — adopt masthead, add `−` glyph + owned-count glyph (FR-022 / FR-024 / FR-026) |
| Component | `apps/mobile/src/components/catalogue/` | NEW — catalogue feature slice (US1, US2, US4) |
| Component | `apps/mobile/src/components/catalogue-filter-sheet/` | NEW — filter sheet (US2) |
| Component | `apps/mobile/src/components/card-detail-sheet/` | NEW — detail sheet shared between Binder + Catalogue (US3, US4) |
| Hook | `apps/mobile/src/hooks/useCatalogueInfiniteQuery.ts` | NEW |
| Hook | `apps/mobile/src/hooks/useCardPricesQuery.ts` | NEW |
| Hook | `apps/mobile/src/hooks/useCardPriceHistoryQuery.ts` | NEW |
| Hook | `apps/mobile/src/hooks/useCardDetailsQuery.ts` | NEW |
| Hook | `apps/mobile/src/hooks/useUpdateBinderEntryMutation.ts` | NEW (cross-feature, owns optimistic update) |
| Service | `apps/mobile/src/services/api/apiClient.ts` | MODIFY — add `searchCards`, `getCardPrices`, `getCardPriceHistory`, `getCard`, `upsertCard`, `patchCard` |
| Mocks | `apps/mobile/jest.setup.ts` | MODIFY — add `@gorhom/bottom-sheet` default mock |
