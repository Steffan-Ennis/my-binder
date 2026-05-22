# Phase 1 Data Model — Card Detail Sheet (spec 020)

No new persisted entity and no migration. Prices are read-through from the MTGJSON SDK
paper-retail dataset. This document records (a) the **wire types reused** from `@my-binder/core`
and (b) the **mobile-only view models** introduced by this feature.

## A. Reused wire types (`@my-binder/core` — already shipped, spec 018)

> Defined once in `packages/core`; the server returns them and the mobile `apiClient` validates
> them. This feature does **not** redefine them (Principle IX / project memory: schemas live in
> core only).

```ts
// packages/core/src/types/card.ts (existing)
export const PRICE_SOURCES = ['CARD_KINGDOM', 'TCG_PLAYER'] as const;   // NO Goldfish slot
export type PriceSource = (typeof PRICE_SOURCES)[number];

export type PriceQuote = {
  source: PriceSource;
  amountCents: number;
  currency: string;       // ISO 4217
  observedOn: string;     // ISO date YYYY-MM-DD
} | null;                 // null when MTGJSON has no observation for (printing, source)

export type CardPricesResponse = {
  printingId: string;
  cardKingdom: PriceQuote;
  tcgPlayer: PriceQuote;
};

export type PricePoint = { observedOn: string; amountCents: number };

export type CardPriceHistoryResponse = {
  printingId: string;
  days: number;
  cardKingdom: PricePoint[];
  tcgPlayer: PricePoint[];
};

// Card identity (existing) — used by the sheet hero + numberOwned for the stepper
export type Card = /* …name, set, setCode, typeLine, oracle, imageRef, numberOwned?… */;
```

**Key rules carried by the wire types:**
- Exactly two **live** sources; the shape is additive (a future spec can add a third slot).
- `PriceQuote = null` and empty `PricePoint[]` are the canonical "no observation" signals — never `0`.
- `amountCents` is the money unit; the mobile layer formats to `$x.xx`.
- Physical printings only (FR-006); digital observations are excluded server-side.

## B. Mobile-only view models (`card-detail-sheet/types.ts` — NEW)

These never cross the wire (Principle X rule 7). View props are `Pick`'d from the query result
types (Principle X rule 5), then extended.

```ts
// PriceRowModel — one rendered price row. Three are built: CK (live), Goldfish (disabled), TCGP (live).
export type PriceRowModel = {
  key: 'cardKingdom' | 'mtgGoldfish' | 'tcgPlayer';
  label: 'Card Kingdom' | 'MTG Goldfish' | 'TCG Player';
  display: string;          // '$17.23' for a live quote, '—' for a missing live quote
  swatchColor: string;      // theme token (gold / dark-red / rose) — paired with the label, never colour-alone
  disabled: boolean;        // true ONLY for the MTG Goldfish "coming soon" placeholder
};

// ChartSeries — one plotted line. Goldfish is NEVER a series (FR-003).
export type ChartSeries = {
  key: 'cardKingdom' | 'tcgPlayer';
  label: 'Card Kingdom' | 'TCG Player';
  color: string;            // theme token
  data: ChartPoint[];       // gifted-charts data, 30-day aligned, gap markers for missing days
};

export type ChartPoint = { value: number; label?: string; hideDataPoint?: boolean /* gap */ };

// Legend entry — three entries; the Goldfish entry is disabled with no series.
export type ChartLegendEntry = { label: string; color: string; disabled: boolean };

// Hook options (Principle X rule 6)
export type UseCardDetailSheetOptions = { printingId: string };

// View props — Pick error/loading/success from the query results, then add feature shape.
export type CardDetailSheetViewProps =
  Pick<UseCardDetailQueryResult, 'error' | 'isLoading' | 'isSuccess'> & {
    // identity
    name?: string; setLabel?: string; typeLine?: string; oracle?: string; imageUrl?: string;
    // ownership stepper (FR-007)
    numberOwned: number; canDecrement: boolean;
    onIncrement: () => void; onDecrement: () => void;
    // prices (FR-002)
    priceRows: PriceRowModel[];
    pricesStatus: 'loading' | 'error' | 'empty' | 'ready';   // FR-008 skeleton / FR-009 error / FR-004 empty
    onRetryPrices: () => void;
    // trend (FR-003 / FR-004)
    chartSeries: ChartSeries[]; chartLegend: ChartLegendEntry[];
    historyStatus: 'loading' | 'error' | 'empty' | 'ready';
    onRetryHistory: () => void;
    // sheet
    onClose: () => void;
  };
```

## C. Derivation rules (in `useCardDetailSheet`, not the view)

| Output | Source | Rule |
|---|---|---|
| `priceRows[CK/TCGP].display` | `CardPricesResponse.cardKingdom/tcgPlayer` | `null` → `'—'`; else `$` + `(amountCents/100).toFixed(2)` (FR-002, FR-004) |
| `priceRows[Goldfish]` | constant | always `{ disabled: true, display: 'Coming soon' }`, no quote (FR-002) |
| `chartSeries` | `CardPriceHistoryResponse.cardKingdom/tcgPlayer` | `priceSeriesToChartData()` per live source; Goldfish excluded (FR-003) |
| `pricesStatus` | prices query | `isLoading`→`loading`; `isError`→`error` (FR-009); both quotes `null`→`empty` (FR-004); else `ready` |
| `historyStatus` | history query | same mapping; both series empty→`empty` ("no recent price data") (FR-004) |
| `numberOwned` / `canDecrement` | `Card.numberOwned` | `canDecrement = numberOwned > 0` (FR-007) |
| stepper success | spec-019 mutation | invalidate `['cards','detail',id]` only; value reconciles on refetch (FR-011, invalidate-only) |

## D. Lifecycle / state

No persisted state. Transient UI state (which printing the sheet is showing) is carried as the
`card-detail` **route param** (`printingId`), not a Zustand store (State locality rule — single
consumer). Query responses live in the in-memory TanStack cache only (no disk persistence).
