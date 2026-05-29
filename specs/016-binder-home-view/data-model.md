# Data Model: Binder Home View

**Feature**: 016-binder-home-view
**Date**: 2026-05-10
**Phase**: 1 (Design & Contracts)

This document captures the entities the binder-home feature reads, the entities it derives,
and the entities it owns at the mobile boundary. The server is the source of truth for the
`Card` data; everything else is derived in the mobile process from the cards plus the user's
interactions.

---

## 1. `Card` (canonical shape — `@my-binder/core`)

The `Card` TypeScript type and its Ajv schema **live in `packages/core`** and are
imported by both `apps/server` and `apps/mobile`. Per the project's schema-of-record
rule, request/response shapes that cross the mobile↔server boundary are defined exactly
once in core; spec 016 extends the canonical shape rather than duplicating it.

```ts
// packages/core/src/types/crud.ts (post-spec-016)
export interface Card {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // ─── Mobile binder-home additions (spec 016) — all OPTIONAL ─────────────────
  // Server may begin returning these in a follow-up enrichment; mobile consumers
  // (binder-home grid + binder-search filter) MUST tolerate their absence and
  // degrade gracefully (placeholder image, name-only filter).
  frontFaceImageUrl?: string;
  setName?: string;
  setCode?: string;
  typeLine?: string;
}

export interface CardList {
  cards: Card[];
  total: number;
  // Optional cursor for forward-compatible cursor pagination consumed by
  // useCardsInfiniteQuery on mobile. Undefined / null today; populated when the
  // server adopts cursor pagination.
  nextCursor?: string | null;
}
```

```ts
// packages/core/src/schemas/card.ts (post-spec-016 — CARD_RESPONSE_SCHEMA + CARD_LIST_RESPONSE_SCHEMA shown)
export const CARD_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    // Optional binder-home fields (spec 016) — not yet returned by the server.
    frontFaceImageUrl: { type: 'string', minLength: 1 },
    setName: { type: 'string' },
    setCode: { type: 'string' },
    typeLine: { type: 'string' },
  },
} as const;

export const CARD_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards', 'total'],
  properties: {
    cards: { type: 'array', items: CARD_RESPONSE_SCHEMA },
    total: { type: 'integer', minimum: 0 },
    nextCursor: { type: ['string', 'null'] },
  },
} as const;
```

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` (uuid) | Server `/cards` response | Required. Stable per-user. |
| `name` | `string` | Server `/cards` response | Required. Filterable. |
| `createdAt` | `string` (date-time) | Server `/cards` response | Required. Existing field — unchanged. |
| `updatedAt` | `string` (date-time) | Server `/cards` response | Required. Existing field — unchanged. |
| `frontFaceImageUrl` | `string?` | Server `/cards` response (future enrichment) | New optional in spec 016. Mobile renders an empty-pocket placeholder when absent (Edge Cases: loading). |
| `setName` | `string?` | Server `/cards` response (future enrichment) | Filterable. Falls back to "" in the haystack when absent. |
| `setCode` | `string?` | Server `/cards` response (future enrichment) | Filterable. Falls back to "" in the haystack when absent. |
| `typeLine` | `string?` | Server `/cards` response (future enrichment) | Filterable. Falls back to "" in the haystack when absent. |

**Mobile-only schema migration (spec 016 cleanup)**: the existing
`apps/mobile/src/services/api/schemas.ts` carries divergent local `Card` and
`CardListResponse` declarations (a hold-over from spec 002 labelled "forward-looking" in
that file). Spec 016 replaces those local declarations with re-exports of the canonical
shapes from `@my-binder/core`; no mobile-only Card/CardListResponse declaration remains
after this spec. Auth-related schemas in the same file (e.g. `GOOGLE_SIGN_IN_RESPONSE_SCHEMA`)
are out of scope for this spec and stay where they are pending a follow-up migration.

**Validation**: every `/cards` response is validated against `CARD_LIST_RESPONSE_SCHEMA`
(imported from `@my-binder/core`) inside the `useCardsInfiniteQuery` `queryFn`
(Principle VII). The optional fields are silently passed through; missing optional
fields validate cleanly because they are not required.

---

## 2. `BinderPage` (derived)

A `BinderPage` is the view-layer projection of nine consecutive cards onto the 3×3 grid.
It is **not stored**; it is derived by the view from the active `cards` array (filtered or
unfiltered) and the `currentPage` index.

```ts
// Derived in BinderHomeView (or the pager render callback) — not persisted.
type Pocket =
  | { kind: 'occupied'; card: Card }
  | { kind: 'empty' };

type BinderPage = {
  pageNumber: number;          // 1-based
  pockets: [Pocket, Pocket, Pocket, Pocket, Pocket, Pocket, Pocket, Pocket, Pocket];
};
```

| Property | Derivation |
|---|---|
| `pageNumber` | `pagerIndex + 1` (1-based throughout the spec). |
| `pockets[i]` | `cards[(pageNumber - 1) * 9 + i]` if defined → `{ kind: 'occupied', card }`; otherwise `{ kind: 'empty' }`. |

**Invariants**:

- Every page has exactly 9 pockets (FR-014).
- The last page may have fewer occupied pockets (FR-022 — partial last page).
- An empty collection still produces one page with 9 empty pockets (FR-021, Edge Case:
  empty collection).

---

## 3. `CollectionSummary` (derived)

A two-field projection used to render the summary caption directly below the header.

```ts
type CollectionSummary = {
  cardCount: number;          // 0 ≤ cardCount
  pageCount: number;          // pageCount = max(1, ceil(cardCount / 9))
};
```

The caption text is composed at the hook boundary by formatting `cardCount` and
`pageCount` per FR-009's pluralisation rule:

| Condition | Caption text |
|---|---|
| `cardCount === 1`, `pageCount === 1` | `"1 CARD · 1 PAGE"` |
| `cardCount > 1`, `pageCount === 1` | `"N CARDS · 1 PAGE"` |
| `cardCount > 1`, `pageCount > 1` | `"N CARDS · M PAGES"` |
| `cardCount === 0` | `"0 CARDS · 1 PAGE"` (FR-005d, Edge Case: empty collection) |
| Loading or error | `"— CARDS · — PAGE"` (FR-010, Edge Cases: loading, network error) |

When a binder-search query is active, `cardCount` is the **filtered** count and `pageCount`
is `max(1, ceil(filteredCount / 9))` (FR-005a).

---

## 4. `BinderSearchState` (owned by `useBinderHome`)

The transient state that drives the inline header search input. Lives in `useState`
inside `useBinderHome`; **not** promoted to a Zustand store (research §2).

```ts
type BinderSearchState = {
  isSearchActive: boolean;     // header is showing the input (true) vs the masthead (false)
  searchQuery: string;         // current text in the input (raw user input, not lowered/trimmed)
  preSearchPage: number;       // page number to restore on close
};

const initialBinderSearchState: BinderSearchState = {
  isSearchActive: false,
  searchQuery: '',
  preSearchPage: 1,
};
```

**State transitions** (US3 acceptance scenarios):

| Event | New state |
|---|---|
| `onSearchOpen()` | `{ isSearchActive: true, searchQuery: '', preSearchPage: binderStore.currentPage }` |
| `onSearchChange(text)` | `{ ..., searchQuery: text }` and `binderStore.setPage(1, totalPagesForFilter(text))` so the user sees page 1 of the filtered set |
| `onSearchClear()` | `{ isSearchActive: false, searchQuery: '', preSearchPage: 1 }` and `binderStore.setPage(preSearchPage, totalPagesForFullCollection)` |
| `onSearchClose()` (input dismissed) | same as `onSearchClear()` per FR-005f |

**Inactive vs active query** (FR-005a):

- An empty or whitespace-only `searchQuery` is treated as **inactive** for filter
  purposes — the filter returns the full `cards` array even when `isSearchActive` is
  `true` (US3 acceptance #2).
- A non-empty trimmed `searchQuery` is **active** — the filter returns only matching
  cards.

---

## 5. Existing entities reused

These entities are owned by spec 002 and are consumed unchanged by this feature.

| Entity | Owner | Used here for |
|---|---|---|
| `useBinderStore` (Zustand) | `apps/mobile/src/stores/binderStore.ts` | `currentPage`, `nextPage`, `prevPage`, `setPage`, `reset` |
| `useSessionStore` (Zustand) | `apps/mobile/src/stores/sessionStore.ts` | `enabled` gating on `useCardsInfiniteQuery` (`status === 'active'`) |
| `pageCount(n)` (utility) | `apps/mobile/src/utils/pageMath.ts` | Page-count math for both filtered and unfiltered paths |
| `slotIndex(n)` (utility) | `apps/mobile/src/utils/pageMath.ts` | Page/slot derivation (defensive — view layer mostly uses array slicing) |
| `apiClient.getCards()` | `apps/mobile/src/services/api/apiClient.ts` | The `/cards` fetch (wrapped by `useCardsInfiniteQuery`) |

---

## 6. New entities introduced by this spec

| Entity | File | Kind |
|---|---|---|
| `binderSearch(cards, query)` | `apps/mobile/src/utils/binderSearch.ts` | Pure function (haystack token-AND filter) |
| `useCardsInfiniteQuery()` | `apps/mobile/src/hooks/useCardsInfiniteQuery.ts` | TanStack `useInfiniteQuery` wrapper |
| `useBinderHome()` | `apps/mobile/src/components/binder-home/useBinderHome.ts` | Feature hook |
| `BinderHomeView` | `apps/mobile/src/components/binder-home/BinderHomeView.tsx` | Pure view component |
| `BinderHomeContainer` | `apps/mobile/src/components/binder-home/BinderHomeContainer.tsx` | One-line container per Principle X |

---

## 7. Validation summary (Principle VII)

| Boundary | Schema | Where it runs |
|---|---|---|
| Inbound `/cards` response | `CARD_LIST_RESPONSE_SCHEMA` (imported from `@my-binder/core`, references the extended `CARD_RESPONSE_SCHEMA`) | Inside `useCardsInfiniteQuery`'s `queryFn` (via `apiClient.getCards`), before the cache stores the value |
| Outbound search query | n/a — the filter never crosses a process or network boundary; no schema needed |

No data is written to local storage by this spec. **Schema-of-record rule**: any new
field on the `/cards` wire shape MUST be added in `packages/core` and consumed by both
apps via `@my-binder/core`; defining a parallel `Card` / `CardList` declaration in
`apps/mobile` or `apps/server` is forbidden.
