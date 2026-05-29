# Contract: Binder Home UI

**Feature**: 016-binder-home-view
**Date**: 2026-05-10
**Owner**: `apps/mobile/src/components/binder-home/`

This document is the **client-side contract** for the binder-home feature: the typed hook
return shape, the view's prop surface, and the route shell. Implementations and tests
are bound to the shapes below; any change MUST update this document and all callers in
the same PR.

---

## 1. `useBinderHome()` — feature hook return shape

```ts
// apps/mobile/src/components/binder-home/useBinderHome.ts
import type { Card } from '@src/services/api/schemas';

export type UseBinderHomeResult = {
  // ─── data ──────────────────────────────────────────────────────────────────
  /** All cards loaded for the current user (post-validation, pre-filter). */
  cards: ReadonlyArray<Card>;
  /** Cards visible after applying the active binder-search query. Equal to `cards` when no query is active. */
  matchedCards: ReadonlyArray<Card>;

  // ─── pagination ────────────────────────────────────────────────────────────
  /** 1-based current page number. Mirrors `binderStore.currentPage`. */
  currentPage: number;
  /** Total page count over `matchedCards`. Always ≥ 1 (FR-021). */
  totalPages: number;

  // ─── presentation ──────────────────────────────────────────────────────────
  /** Pre-formatted summary string (e.g. "7 CARDS · 1 PAGE", "— CARDS · — PAGE"). */
  summaryCaption: string;
  /** True iff `matchedCards` is empty AND a non-empty search query is active. Drives the "no matches" message (FR-005d). */
  noMatches: boolean;
  /** Loading flag for first paint of the cards query (drives the placeholder grid + dashed caption). */
  isLoading: boolean;
  /** Error flag for the cards query (drives the inline retry affordance, replaces the grid). */
  isError: boolean;

  // ─── search ────────────────────────────────────────────────────────────────
  /** True iff the inline header search input is open. Drives the masthead-vs-input toggle. */
  isSearchActive: boolean;
  /** Current text in the search input (raw user input). Drives the controlled `<TextInput>`. */
  searchQuery: string;
  /** Open the inline search input; captures `currentPage` into `preSearchPage`. */
  onSearchOpen: () => void;
  /** Update the search query; recomputes `matchedCards` and resets `currentPage` to 1 of the filtered set. */
  onSearchChange: (text: string) => void;
  /** Close the inline search input; restores `currentPage` to `preSearchPage` and clears the query. */
  onSearchClear: () => void;

  // ─── pagination handlers ──────────────────────────────────────────────────
  /** Advance the binder by one page; clamped at `totalPages` (no-op on the last page). */
  onNextPage: () => void;
  /** Step the binder back by one page; clamped at 1 (no-op on the first page). */
  onPrevPage: () => void;
  /** Sync the store with a `react-native-pager-view` `onPageSelected` event. */
  onPageChange: (oneBasedPage: number) => void;

  // ─── navigation ────────────────────────────────────────────────────────────
  /** Header Profile shortcut — navigates to the Profile tab (FR-006). */
  onProfilePress: () => void;

  // ─── retry ─────────────────────────────────────────────────────────────────
  /** Refetch the `/cards` query — wired to the inline retry affordance shown on `isError`. */
  onRetryPress: () => void;
};
```

**Stability contract** (Principle X v1.16.0):

- Every function returned by `useBinderHome` MUST be wrapped in `useCallback` with an
  exhaustive dep array.
- `cards` and `matchedCards` MUST be wrapped in `useMemo` (TanStack Query's `data` is
  reference-stable, but `data.pages.flatMap(...)` is a fresh array per render).
- `summaryCaption`, `noMatches`, `currentPage`, `totalPages`, `isSearchActive`,
  `searchQuery`, `isLoading`, `isError` are primitives or query-derived primitives and
  do not require memoisation.
- The whole return object MUST itself be wrapped in `useMemo` so destructuring callers
  (`BinderHomeContainer`) get a stable identity per render.

---

## 2. `BinderHomeView` — prop surface

```ts
// apps/mobile/src/components/binder-home/BinderHomeView.tsx

export type BinderHomeViewProps = {
  // mirrors UseBinderHomeResult one-for-one (named props per Principle X — no spread)
  cards: ReadonlyArray<Card>;
  matchedCards: ReadonlyArray<Card>;
  currentPage: number;
  totalPages: number;
  summaryCaption: string;
  noMatches: boolean;
  isLoading: boolean;
  isError: boolean;
  isSearchActive: boolean;
  searchQuery: string;
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClear: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onPageChange: (oneBasedPage: number) => void;
  onProfilePress: () => void;
  onRetryPress: () => void;
};
```

**Forbidden imports** (Principle X View row):

- ❌ `useState`, `useEffect`, `useReducer` (inside `BinderHomeView`)
- ❌ Any import from `@src/stores/*`
- ❌ Any import from `@src/services/*`
- ❌ Any import from `expo-router`
- ❌ `Alert`, `Linking`, or other side-effecting native API

**Permitted imports**:

- ✅ `react`, `react-native`, `expo-image`, `react-native-pager-view`,
  `@expo/vector-icons`, `@src/constants/theme`, `@src/services/api/schemas` (type-only)

**Accessibility contract**:

| Element | Role | Label |
|---|---|---|
| Binder-search header button | `button` | `"Search the binder"` |
| Profile header shortcut | `button` | `"Open profile"` |
| Inline search input (when open) | `searchbox` | `"Search this binder"` |
| Search clear/cancel control | `button` | `"Clear search"` |
| Prev page button | `button` | `"Previous page"` (state `disabled` when `currentPage === 1`) |
| Next page button | `button` | `"Next page"` (state `disabled` when `currentPage === totalPages`) |
| Retry affordance (on `isError`) | `button` | `"Retry loading binder"` |

---

## 3. `BinderHomeContainer` — Principle X glue

```tsx
// apps/mobile/src/components/binder-home/BinderHomeContainer.tsx
import type { FC } from 'react';

import { BinderHomeView } from './BinderHomeView';
import { useBinderHome } from './useBinderHome';

const BinderHomeContainer: FC = () => {
  const {
    cards,
    matchedCards,
    currentPage,
    totalPages,
    summaryCaption,
    noMatches,
    isLoading,
    isError,
    isSearchActive,
    searchQuery,
    onSearchOpen,
    onSearchChange,
    onSearchClear,
    onNextPage,
    onPrevPage,
    onPageChange,
    onProfilePress,
    onRetryPress,
  } = useBinderHome();

  return (
    <BinderHomeView
      cards={cards}
      matchedCards={matchedCards}
      currentPage={currentPage}
      totalPages={totalPages}
      summaryCaption={summaryCaption}
      noMatches={noMatches}
      isLoading={isLoading}
      isError={isError}
      isSearchActive={isSearchActive}
      searchQuery={searchQuery}
      onSearchOpen={onSearchOpen}
      onSearchChange={onSearchChange}
      onSearchClear={onSearchClear}
      onNextPage={onNextPage}
      onPrevPage={onPrevPage}
      onPageChange={onPageChange}
      onProfilePress={onProfilePress}
      onRetryPress={onRetryPress}
    />
  );
};

export default BinderHomeContainer;
export { BinderHomeContainer };
```

The container MUST be exactly this shape — destructured named props, no spread, no
local state. Tests for the container are optional (the contract here makes its
behaviour entirely mechanical); the view and hook tests carry the load.

---

## 4. Route shell

```tsx
// apps/mobile/src/app/(authenticated)/(tabs)/binder.tsx (rewritten by this spec)
import type { FC } from 'react';

import { BinderHomeContainer } from '@src/components/binder-home/BinderHomeContainer';

const Binder: FC = () => <BinderHomeContainer />;
export default Binder;
```

---

## 5. Tabs layout change

```tsx
// apps/mobile/src/app/(authenticated)/(tabs)/_layout.tsx (modified by this spec)
<Tabs.Screen
  name="binder"
  options={{
    headerShown: false, // ← added in this spec; the binder-home renders its own header (FR-001)
    tabBarLabel: 'Binder',
    tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
  }}
/>
```

Other `Tabs.Screen` entries are unchanged.

---

## 6. Sign-out reset (cross-spec hook update)

`useSignOutMutation.onSuccess` (owned by spec 002 in
`apps/mobile/src/hooks/useSignOutMutation.ts`) is amended to call
`useBinderStore.getState().reset()` before `queryClient.clear()`. This satisfies the
SC-007 / FR-023 boundary that page memory MUST NOT survive sign-out.

```ts
// apps/mobile/src/hooks/useSignOutMutation.ts (excerpt — diff)
- queryClient.clear();
+ useBinderStore.getState().reset();
+ queryClient.clear();
```

The existing `useSignOutMutation.test.tsx` MUST be extended with one assertion that the
store is reset on successful sign-out.
