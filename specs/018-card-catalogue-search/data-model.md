# Phase 1 Data Model: Card Catalogue Search

**Spec**: [./spec.md](./spec.md) | **Plan**: [./plan.md](./plan.md) | **Research**: [./research.md](./research.md)
**Branch**: `018-card-catalogue-search` | **Date**: 2026-05-17

This document captures every entity, field, validation rule, relationship,
and state transition introduced or modified by spec 018. Type and schema
definitions are split between `packages/core` (shared wire shapes) and
`apps/server/src/entities/` (TypeORM persistence).

---

## 1. Modifications to existing entities

### 1.1 `CardEntity` — add `number_owned` column

**File**: `apps/server/src/entities/CardEntity.ts`

```diff
 @Entity('cards')
 export class CardEntity {
   @PrimaryColumn({ name: 'id', type: 'uuid' })
   id!: string;

   @Column({ name: 'name', type: 'varchar', length: 500 })
   name!: string;

   @PrimaryColumn({ name: 'user_id', type: 'uuid' })
   userId!: string;

+  // FR-023: the user owns this many physical copies of this printing.
+  // Always >= 1 while the row exists; the row is deleted when a decrement
+  // brings the count to 0 (FR-026). Default applied at insert time when
+  // POST /cards creates a brand-new (id, user_id) pair.
+  @Column({ name: 'number_owned', type: 'integer', default: 1 })
+  numberOwned!: number;

   @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
   createdAt!: Date;
   // …
 }
```

**Migration**: new TypeORM migration
`apps/server/src/db/migrations/<ts>-add-number-owned.ts`:

```sql
ALTER TABLE "cards"
  ADD COLUMN "number_owned" integer NOT NULL DEFAULT 1
  CHECK ("number_owned" >= 1);
```

Existing rows backfill to `1` (default). The `CHECK >= 1` invariant is the
schema-level expression of FR-023's "row with `numberOwned = 0` MUST NOT
appear in the binder" — a row that would decrement to 0 is deleted, never
persisted at 0.

**Validation rules** (FR-023):

- `numberOwned` MUST be an integer >= 1 for any persisted row.
- `numberOwned` MUST be derived from the mutation chain only — no API
  permits setting it directly.
- A decrement that would bring `numberOwned` to 0 MUST delete the row
  inside the same transaction.

**State transitions**:

| From state | Trigger | To state |
|---|---|---|
| (no row) | `POST /cards { id, name }` (create) | `numberOwned = 1` |
| `numberOwned = N` (N >= 1) | `POST /cards { id, name }` (duplicate) | `numberOwned = N + 1` |
| `numberOwned = N` (N >= 1) | `PATCH /cards/:id { delta: +1 }` | `numberOwned = N + 1` |
| `numberOwned = N` (N >= 2) | `PATCH /cards/:id { delta: -1 }` | `numberOwned = N - 1` |
| `numberOwned = 1` | `PATCH /cards/:id { delta: -1 }` | (row deleted) |
| `numberOwned = 0` | (never persisted) | n/a |
| `numberOwned = N` (any) | `DELETE /cards/:id` | (row deleted; explicit clear-all) |

### 1.2 `Card` wire shape — add `numberOwned`

**File**: `packages/core/src/types/crud.ts`

```diff
 export interface Card {
   id: string;
   name: string;
   createdAt: string;
   updatedAt: string;
   // Mobile binder-home additions (spec 016) — all OPTIONAL.
   setName?: string;
   setCode?: string;
   typeLine?: string;
+  // Spec 018 / FR-023: physical copies the signed-in user owns for this
+  // printing. Always present on responses scoped to a user (GET /cards,
+  // GET /cards/search when authenticated). Always >= 1 on /cards
+  // responses (the binder never returns 0-count rows); >= 0 on
+  // /cards/search responses (zero means the user does not own the
+  // printing).
+  numberOwned?: number;
 }
```

**File**: `packages/core/src/schemas/card.ts`

```diff
 export const CARD_RESPONSE_SCHEMA = {
   type: 'object',
   additionalProperties: true,
   required: ['id', 'name'],
   properties: {
     id: { type: 'string', format: 'uuid' },
     name: { type: 'string', minLength: 1, maxLength: 255 },
     createdAt: { type: 'string', format: 'date-time' },
     updatedAt: { type: 'string', format: 'date-time' },
     setName: { type: 'string' },
     setCode: { type: 'string' },
     typeLine: { type: 'string' },
+    numberOwned: { type: 'integer', minimum: 0 },
   },
 } as const;
```

`numberOwned` is `minimum: 0` in the schema (the catalogue surface returns
0 for unowned printings) but is constrained to `minimum: 1` at the DB
layer (the binder never returns 0-count rows). The two constraints are
not contradictory — the DB never persists 0; the catalogue endpoint
synthesises 0 via the LEFT JOIN's `COALESCE(cards.number_owned, 0)`.

### 1.3 `CardRecord` wire shape — add `numberOwned`

**File**: `packages/core/src/types/card.ts`

```diff
 export type CardRecord = {
   id: string;
   name: string;
   set: string;
   cardNumber: string;
   manaCost: string | null;
   colorIdentity: string[];
   commanderLegal?: boolean;
   imageRef?: string | null;
+  // Spec 018 / FR-024: the signed-in user's owned count for this
+  // printing. Always populated on catalogue search responses (0 when
+  // unowned). Allows the catalogue glyph to render from the cell payload
+  // alone — no second request.
+  numberOwned?: number;
 };
```

**File**: `packages/core/src/schemas/card.ts`

```diff
 export const CARD_RECORD_SCHEMA = {
   type: 'object',
   additionalProperties: false,
   required: ['name', 'set', 'cardNumber', 'manaCost', 'colorIdentity'],
   properties: {
     name: { type: 'string' },
     set: { type: 'string' },
     cardNumber: { type: 'string' },
     manaCost: { type: ['string', 'null'] },
     colorIdentity: { type: 'array', items: { type: 'string' } },
     commanderLegal: { type: 'boolean' },
     imageRef: { type: ['string', 'null'] },
+    numberOwned: { type: 'integer', minimum: 0 },
   },
 } as const;
```

### 1.4 `SearchQuery` wire shape — add catalogue filter dimensions

**File**: `packages/core/src/types/card.ts`

```diff
 export type SearchQuery = {
   name?: string;
   set?: string;
   colorIdentity?: string[];
   cmcMin?: number;
   cmcMax?: number;
   page?: number;
   limit?: number;
+  // Spec 018 / FR-005 catalogue filter dimensions.
+  formats?: string[];        // OR within dimension; e.g. ['Modern', 'Legacy']
+  superTypes?: string[];     // OR within dimension; e.g. ['Legendary', 'Basic']
+  subTypes?: string[];       // OR within dimension; e.g. ['Equipment', 'Aura']
+  creatureTypes?: string[];  // OR within dimension; e.g. ['Elf', 'Goblin']
+  // Restricts results to printings whose `numberOwned` for the
+  // signed-in user is 0. Requires the request to carry a user identity.
+  missingOnly?: boolean;
+  // Internal — the userId the service layer joins on for missingOnly and
+  // numberOwned. Not part of the wire shape; populated by the route
+  // handler from `request.identity`. Mobile clients MUST NOT set this.
+  userId?: string;
 };
```

**File**: `packages/core/src/schemas/card.ts`

```diff
 export const SEARCH_QUERYSTRING_SCHEMA = {
   type: 'object',
   properties: {
     name:    { type: 'string' },
     set:     { type: 'string' },
     colors:  { type: 'string' },
     cmc_min: { type: 'integer', minimum: 0 },
     cmc_max: { type: 'integer', minimum: 0 },
     page:    { type: 'integer', minimum: 1, default: 1 },
     limit:   { type: 'integer', minimum: 1, maximum: 100, default: 20 },
+    formats:         { type: 'string' },  // comma-separated
+    super_types:     { type: 'string' },  // comma-separated
+    sub_types:       { type: 'string' },  // comma-separated
+    creature_types:  { type: 'string' },  // comma-separated
+    missing_only:    { type: 'boolean' },
   },
   additionalProperties: false,
 } as const;
```

**Validation rules**:

- `formats`, `super_types`, `sub_types`, `creature_types`: optional
  comma-separated lists of free-form strings. Whitespace around tokens is
  trimmed by the route handler. Empty strings inside the list are
  ignored. Case-sensitive match against the provider's vocabulary
  (`Standard` vs `standard` is not the same).
- `missing_only`: optional boolean. When `true` AND the request is
  unauthenticated, the route returns 401 (cannot evaluate `numberOwned`
  without a user identity).
- The existing MISSING_FILTER 400 short-circuit MUST drop when
  `missing_only=true` is the only filter — an authenticated `missing_only`
  request is a valid full-catalogue browse.

---

## 2. New types (no new entities)

Price data is sourced live from the **MTGJSON SDK** (`sdk.prices.today`
and `sdk.prices.history`) via the provider abstraction — see
[research.md §7](./research.md#7-price-observation-data-path). No
TypeORM entity, no Postgres table, and no migration is added by this
spec. The wire-shape contract (`CardPricesResponse`,
`CardPriceHistoryResponse`) and the provider-interface extension are
the only persistence-adjacent changes.

### 2.1 `CardProvider` interface extension

**File**: `apps/server/src/providers/interface.ts` (modify)

```diff
 export type CardProvider = {
   checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult>;
   search(query: SearchQuery): Promise<CardRecord[]>;
   getByUuid(uuid: string): Promise<CardDetails | null>;
   getByUuids(uuid: string[]): Promise<CardRecord[]>
   getCardImages(uuid: string): Promise<CardImages | null>;
+  // Spec 018 / FR-017: latest observation per source for one printing.
+  // Returns null per slot when MTGJSON has no observation for that
+  // (printing, source) pair (FR-019 — UI renders "—"). Returns the
+  // whole response with all-null slots when the printing is known but
+  // has no observations at all. Throws when the underlying provider
+  // (SDK) is unavailable; the route layer maps to 503.
+  getPrices(uuid: string): Promise<CardPricesResponse>;
+  // Spec 018 / FR-018: per-source price series for the last `days`
+  // calendar days ending today. Empty arrays per slot when no
+  // observations exist for that source within the window.
+  getPriceHistory(uuid: string, days: number): Promise<CardPriceHistoryResponse>;
   isReachable(): Promise<boolean>;
 };
```

The wire types referenced (`CardPricesResponse`, `CardPriceHistoryResponse`,
`PriceQuote`, `PricePoint`, `PriceSource`) are defined in §2.3 below.

### 2.2 MTGJSON SDK mapping (implementation note)

`MtgjsonProvider` implements both new methods by calling the SDK's
`PriceQuery` layer:

```ts
// apps/server/src/providers/mtgjson/MtgjsonProvider.ts (excerpt)
const PROVIDER_KEYS: Record<PriceSource, string> = {
  CARD_KINGDOM: 'cardkingdom',
  TCG_PLAYER:   'tcgplayer',
};

async getPrices(uuid: string): Promise<CardPricesResponse> {
  const results = await Promise.all(
    PRICE_SOURCES.map(async (source) => {
      const rows = await this.sdk.prices.today(uuid, {
        provider:  PROVIDER_KEYS[source],
        finish:    'normal',
        priceType: 'retail',
      });
      return [source, mapTodayToQuote(source, rows)] as const;
    }),
  );
  return {
    printingId:  uuid,
    cardKingdom: results.find(([source]) => source === 'CARD_KINGDOM')![1],
    tcgPlayer:   results.find(([source]) => source === 'TCG_PLAYER')![1],
  };
}
```

`sdk.prices.history` is called identically with `dateFrom = today -
days` and `dateTo = today` for the history endpoint. MTG Goldfish is
deferred to a follow-up specification per the spec's 2026-05-18
Clarifications entry — MTGJSON does not publish MTG Goldfish data, so
adding a third row requires bespoke ingestion work outside this spec.
When that follow-up lands, it adds a third entry to `PROVIDER_KEYS`
(or extends `getPrices` to call a separate MTG Goldfish adapter) and
the wire shapes extend additively; nothing in spec 018 needs to
predict the integration.

### 2.3 `PriceSource` enum

**File**: `packages/core/src/types/card.ts` (new export)

```ts
export const PRICE_SOURCES = ['CARD_KINGDOM', 'TCG_PLAYER'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
```

### 2.4 Price wire shapes

**File**: `packages/core/src/types/card.ts` (new exports)

```ts
// Latest observation per source for a single printing.
export type PriceQuote = {
  source: PriceSource;
  amountCents: number;
  currency: string;       // ISO 4217
  observedOn: string;     // ISO date
} | null;

export type CardPricesResponse = {
  printingId: string;
  cardKingdom: PriceQuote;
  tcgPlayer:   PriceQuote;
};

// 30-day series per source.
export type PricePoint = {
  observedOn: string;     // ISO date
  amountCents: number;
};

export type CardPriceHistoryResponse = {
  printingId: string;
  days: number;           // window length (30 for this spec)
  cardKingdom: PricePoint[];
  tcgPlayer:   PricePoint[];
};
```

*MTG Goldfish is deferred to a follow-up specification (spec's
2026-05-18 Clarifications entry). The wire shapes are designed
additively — a future spec adds a third `mtgGoldfish` field to both
response types without changing existing consumers.*

**File**: `packages/core/src/schemas/card.ts` (new constants)

```ts
export const PRICE_QUOTE_SCHEMA = {
  oneOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'amountCents', 'currency', 'observedOn'],
      properties: {
        source:       { type: 'string', enum: ['CARD_KINGDOM', 'TCG_PLAYER'] },
        amountCents:  { type: 'integer', minimum: 0 },
        currency:     { type: 'string', minLength: 3, maxLength: 3 },
        observedOn:   { type: 'string', format: 'date' },
      },
    },
  ],
} as const;

export const CARD_PRICES_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['printingId', 'cardKingdom', 'tcgPlayer'],
  properties: {
    printingId:   { type: 'string', format: 'uuid' },
    cardKingdom:  PRICE_QUOTE_SCHEMA,
    tcgPlayer:    PRICE_QUOTE_SCHEMA,
  },
} as const;

export const PRICE_POINT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['observedOn', 'amountCents'],
  properties: {
    observedOn:   { type: 'string', format: 'date' },
    amountCents:  { type: 'integer', minimum: 0 },
  },
} as const;

export const CARD_PRICE_HISTORY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['printingId', 'days', 'cardKingdom', 'tcgPlayer'],
  properties: {
    printingId:   { type: 'string', format: 'uuid' },
    days:         { type: 'integer', minimum: 1, maximum: 365 },
    cardKingdom:  { type: 'array', items: PRICE_POINT_SCHEMA },
    tcgPlayer:    { type: 'array', items: PRICE_POINT_SCHEMA },
  },
} as const;
```

### 2.5 `PATCH /cards/:id` request body

**File**: `packages/core/src/types/crud.ts` (new export)

```ts
export type PatchCardBody = {
  // +1 increments numberOwned; -1 decrements (deleting the row at 0).
  // Any other value is rejected with VALIDATION_ERROR.
  delta: 1 | -1;
};
```

**File**: `packages/core/src/schemas/card.ts` (new constant)

```ts
export const PATCH_CARD_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['delta'],
  properties: {
    delta: { type: 'integer', enum: [1, -1] },
  },
} as const;
```

---

## 3. Catalogue feature data shapes (mobile-only)

These types live in `apps/mobile/src/components/catalogue/types.ts` per
Principle X v1.26.0 (Data-fetching hook composition rule, sub-rule 7).
They are mobile-side typedefs that compose the existing core types — they
MUST NOT be re-declared in `packages/core`.

### 3.1 `CatalogueFilterSet`

```ts
import type { PriceSource } from '@my-binder/core';

export type CatalogueFilterSet = {
  // Search input — case-insensitive substring against card name.
  name: string;
  // Selected sets (FR-005). OR within dimension.
  sets: ReadonlyArray<string>;
  // Selected format-legality values (FR-005). OR within dimension.
  formats: ReadonlyArray<string>;
  // Selected card super types (FR-005). OR within dimension.
  superTypes: ReadonlyArray<string>;
  // Selected card sub types (FR-005). OR within dimension.
  subTypes: ReadonlyArray<string>;
  // Selected creature types (FR-005). OR within dimension.
  creatureTypes: ReadonlyArray<string>;
  // Selected colour identity letters: 'W'|'U'|'B'|'R'|'G'|'C'. OR.
  colors: ReadonlyArray<'W' | 'U' | 'B' | 'R' | 'G' | 'C'>;
  // CMC range — inclusive bounds. Default `[0, 20]` = unconstrained.
  cmcMin: number;
  cmcMax: number;
  // `Missing only` toggle (FR-005, clarification 3 of 2026-05-17).
  missingOnly: boolean;
};

export const EMPTY_FILTER_SET: CatalogueFilterSet = {
  name: '',
  sets: [],
  formats: [],
  superTypes: [],
  subTypes: [],
  creatureTypes: [],
  colors: [],
  cmcMin: 0,
  cmcMax: 20,
  missingOnly: false,
};
```

**State transitions** (drives the catalogue's filter-pill row + filter sheet):

| From state | Trigger | To state |
|---|---|---|
| `EMPTY_FILTER_SET` | user types in search input | `{ ...prev, name: text }` |
| any | user selects/deselects a chip | `{ ...prev, <dimension>: toggle(prev.<dimension>, value) }` |
| any | user toggles "Missing only" | `{ ...prev, missingOnly: !prev.missingOnly }` |
| any | user changes CMC range | `{ ...prev, cmcMin, cmcMax }` |
| any | user removes one pill (FR-008) | per-dimension removal |
| any | user taps "Clear all" (FR-008) | `EMPTY_FILTER_SET` |

`useCatalogueFilters` is the single owner of this state. It exposes
`filters` plus a stable callback API (`setName`, `toggleSet`,
`toggleFormat`, `toggleSuperType`, `toggleSubType`, `toggleCreatureType`,
`toggleColor`, `setCmcRange`, `toggleMissingOnly`, `removePill`,
`clearAll`). Per Principle X State locality rule, this state lives in
the feature hook — it is single-consumer (only the catalogue reads it)
and no Zustand store is introduced.

### 3.2 `CataloguePage`

```ts
import type { CardRecord } from '@my-binder/core';

export type CataloguePage = {
  pageNumber: number;       // 1-based
  cards: ReadonlyArray<CardRecord>;
  isPlaceholder: boolean;   // true while the underlying query is fetching
};
```

The view receives `pages: ReadonlyArray<CataloguePage>` (one per loaded
page in the TanStack infinite cache). Pages that have not yet been fetched
are absent — the view renders skeleton pockets in their slot once the user
swipes to them.

### 3.3 `CatalogueViewProps`

```ts
import type { Pick } from 'react';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ApiError } from '@src/services/api/ApiError';

export type CatalogueViewProps = Pick<
  UseInfiniteQueryResult<CataloguePageCache, ApiError>,
  'error' | 'isLoading' | 'isFetchingNextPage'
> & {
  // Display state
  subtitle: 'Catalogue';
  pages: ReadonlyArray<CataloguePage>;
  currentPage: number;
  totalPages: number | null;   // null when result set is still open-ended
  summaryCaption: string;
  hasNextPage: boolean;
  resultsAreStale: boolean;     // FR-031

  // Filter surface
  filters: CatalogueFilterSet;
  filterPills: ReadonlyArray<{ id: string; label: string }>;
  filterSheetOpen: boolean;

  // Detail sheet surface (shared with binder)
  detailPrintingId: string | null;
  detailSheetOpen: boolean;

  // Masthead surface
  isSearchActive: boolean;
  searchQuery: string;

  // Callbacks
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClose: () => void;
  onProfilePress: () => void;
  onPocketPress: (printingId: string) => void;
  onPocketAddPress: (printingId: string) => void;
  onPagerSelected: (pageNumber: number) => void;
  onFilterPillRemove: (pillId: string) => void;
  onFilterSheetOpen: () => void;
  onFilterSheetClose: () => void;
  onFilterClear: () => void;
  onFilterApply: () => void;
  onRefreshPress: () => void;     // FR-031
};
```

Per Principle X v1.26.0, fields that TanStack already types
(`error`, `isLoading`, `isFetchingNextPage`) are `Pick`'d from
`UseInfiniteQueryResult<…>` — never redeclared.

---

## 4. Card detail sheet data shapes (mobile-only)

**File**: `apps/mobile/src/components/card-detail-sheet/types.ts` (new)

```ts
import type { Pick } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  CardImages,
  CardPricesResponse,
  CardPriceHistoryResponse,
} from '@my-binder/core';
import type { ApiError } from '@src/services/api/ApiError';

export type UseCardDetailSheetOptions = {
  printingId: string | null;
  // Drives stepper "+" / "−" hint text below the count.
  surface: 'binder' | 'catalogue';
};

export type CardDetailViewProps =
  & Pick<UseQueryResult<CardImages,                ApiError>, 'isLoading' | 'isSuccess'>
  & Pick<UseQueryResult<CardPricesResponse,        ApiError>, 'error'>
  & {
    // Header
    printingId: string | null;
    name: string;
    setCode: string;
    setName: string;
    typeLine: string;
    oracleText: string;
    artUrl: string | null;

    // Stepper
    numberOwned: number;
    canDecrement: boolean;
    onIncrement: () => void;
    onDecrement: () => void;

    // Prices section (FR-017)
    cardKingdomPrice: PriceQuoteDisplay;
    tcgPlayerPrice:   PriceQuoteDisplay;

    // 30-day chart (FR-018)
    priceHistory: CardPriceHistoryResponse | null;
    isPriceHistoryLoading: boolean;

    // Sheet lifecycle
    onClose: () => void;
  };

export type PriceQuoteDisplay = {
  source: 'Card Kingdom' | 'TCG Player';
  swatchColor: string;
  // Formatted as e.g. "$13.78" or the placeholder "—" when no observation.
  displayValue: string;
};
```

**State transitions** (the detail sheet):

| From state | Trigger | To state |
|---|---|---|
| closed (`printingId = null`) | user taps a pocket | open with that printing |
| open | user taps `+` | `numberOwned += 1`; optimistic cache update |
| open at `numberOwned = N` (N >= 1) | user taps `−` | `numberOwned -= 1`; row removed at 0 |
| open at `numberOwned = 0` | user taps `−` | no-op (button disabled) |
| open | user swipes down past threshold | closed (FR-020) |
| open | user taps close control | closed (FR-020) |
| open | app backgrounded | still open on resume (Edge Case) |

---

## 5. Masthead component data shape (mobile-only)

**File**: `apps/mobile/src/components/masthead/types.ts` (new)

```ts
import type { ReactNode } from 'react';

export type MastheadProps = {
  subtitle: string;                       // FR-002 (a)
  searchPlaceholder: string;
  isSearchActive: boolean;
  searchQuery: string;
  hasActiveQuery: boolean;
  onSearchOpen: () => void;               // FR-002 (b)
  onSearchChange: (text: string) => void;
  onSearchClose: () => void;
  onProfilePress: () => void;             // FR-002 (c)
  // Optional filter-pill row slot (catalogue only). When undefined the
  // masthead does not render the row.
  filterPills?: ReactNode;
};
```

The masthead is **stateless and prop-driven** — it does not own
`isSearchActive`, `searchQuery`, or `hasActiveQuery`. Those fields live
in the consuming feature hook (`useBinderHome`, `useCatalogue`) and are
threaded down. This keeps Principle X State locality intact — both
consumers reuse the masthead as a pure presentation component, and the
masthead does not need a hook layer of its own.

---

## 6. Relationships

```
CardEntity        (id, userId, numberOwned)
                  ↓
                  id      → MTGJSON printing UUID
                            (resolved live via provider.getByUuid)
                  userId  → UserEntity.id  (existing FK)

Catalogue surface = MTGJSON catalogue (via provider.search) LEFT JOIN
                    CardEntity ON CardEntity.id = printing.uuid
                                AND CardEntity.user_id = :authUserId
                    ⇒ numberOwned = COALESCE(CardEntity.number_owned, 0)

Prices surface    = provider.getPrices(uuid) → MTGJSON SDK
                    prices.today / prices.history (per-provider key,
                    finish='normal', priceType='retail')
                    No database touchpoint.
```

No foreign-key constraint is added between `cards.id` and the MTGJSON
catalogue because the catalogue lives in the parquet cache, not in
Postgres. The provider abstraction (Principle VI) is the single source
of truth for catalogue identity AND for price observations; the
database treats those UUIDs as opaque references.

---

## 7. Summary of additions

| Layer | File | Change |
|---|---|---|
| Postgres | `apps/server/src/db/migrations/<ts>-add-number-owned.ts` | NEW — adds `number_owned` column to `cards` |
| TypeORM | `apps/server/src/entities/CardEntity.ts` | MODIFY — adds `numberOwned` column |
| Provider IF | `apps/server/src/providers/interface.ts` | MODIFY — `CardProvider` gains `getPrices(uuid)` and `getPriceHistory(uuid, days)` |
| Core types | `packages/core/src/types/crud.ts` | MODIFY — adds `numberOwned?` to `Card`; adds `PatchCardBody` |
| Core types | `packages/core/src/types/card.ts` | MODIFY — adds `numberOwned?` to `CardRecord`, catalogue filter dimensions to `SearchQuery`; NEW — `PriceSource`, `PriceQuote`, `CardPricesResponse`, `PricePoint`, `CardPriceHistoryResponse` |
| Core schemas | `packages/core/src/schemas/card.ts` | MODIFY — adds `numberOwned` to `CARD_RESPONSE_SCHEMA` + `CARD_RECORD_SCHEMA`, adds filter fields to `SEARCH_QUERYSTRING_SCHEMA`; NEW — `PRICE_QUOTE_SCHEMA`, `CARD_PRICES_RESPONSE_SCHEMA`, `PRICE_POINT_SCHEMA`, `CARD_PRICE_HISTORY_RESPONSE_SCHEMA`, `PATCH_CARD_BODY_SCHEMA` |
| Mobile types | `apps/mobile/src/components/masthead/types.ts` | NEW — `MastheadProps` |
| Mobile types | `apps/mobile/src/components/catalogue/types.ts` | NEW — `CatalogueFilterSet`, `CataloguePage`, `CatalogueViewProps`, `UseCatalogueOptions` |
| Mobile types | `apps/mobile/src/components/card-detail-sheet/types.ts` | NEW — `UseCardDetailSheetOptions`, `CardDetailViewProps`, `PriceQuoteDisplay` |
