# Phase 1 Data Model — 30-Day Price Trend Chart (spec 021)

No new persisted entity, no migration, **no wire-type or schema change**, and **no change to the mobile view models or geometry** shipped by spec 020. The chart is re-introduced on top of the existing, unchanged data layer. This document records what is **reused as-is** and the one **additive** type (`PriceTrendChartProps`) plus the single-point guard.

## A. Reused wire types (`@my-binder/core` — unchanged)

```ts
// packages/core/src/types/card.ts (existing — NOT modified)
export type PricePoint = { observedOn: string; amountCents: number };
export type CardPriceHistoryResponse = {
  printingId: string;
  days: number;
  cardKingdom: PricePoint[];
  tcgPlayer: PricePoint[];
};
```

Physical-only, paper-retail, two live sources. Empty `PricePoint[]` = "no observation" (never `0`). `amountCents` → `$` by `/100`.

## B. Reused mobile view models (`card-detail-sheet/types.ts` — unchanged, except one additive type)

These survived the spec-020 deferral and are **kept exactly**:

```ts
// One point on a plotted line. hideDataPoint marks a gap day (FR-004) — never $0.
export type ChartPoint = { value: number; label?: string; hideDataPoint?: boolean };

// One plotted line. MTG Goldfish is NEVER a series (FR-003).
export type ChartSeries = {
  key: 'cardKingdom' | 'tcgPlayer';
  label: 'Card Kingdom' | 'TCG Player';
  color: string;          // theme token — paired with a text label, never colour-alone (FR-006)
  data: ChartPoint[];     // gifted-charts data, 30-day aligned, gap markers for missing days
};

// Legend entry — three entries; the Goldfish entry is disabled with no line (FR-003).
export type ChartLegendEntry = { label: string; color: string; disabled: boolean };
```

**ADDITIVE — the only new type:**

```ts
// Props for the re-created presentational chart.
export type PriceTrendChartProps = {
  chartSeries: ChartSeries[];      // 0–2 live series (Goldfish never present)
  chartLegend: ChartLegendEntry[]; // exactly 3 entries (CK, Goldfish disabled, TCGP)
};
```

`CardDetailSheetViewProps` already carries `chartSeries`, `chartLegend`, `historyStatus`, `onRetryHistory` — **no change** beyond the view now consuming them in the `ready` branch.

## C. Derivation rules (in `useCardDetailSheet` — UNCHANGED)

Reused verbatim from spec 020 (the hook already produces these; this feature does not edit the hook):

| Output | Source | Rule |
|---|---|---|
| `chartSeries` | `CardPriceHistoryResponse.cardKingdom`/`.tcgPlayer` via `priceSeriesToChartData()` | one series per **live** source that yields ≥1 point; Goldfish never a series (FR-003) |
| `chartLegend` | module constant | `[CK active, MTG Goldfish disabled, TCG Player active]` — reference-stable (FR-003) |
| `historyStatus` | history query | `isError`→`error`; no data→`loading`; both series empty→`empty`; else→`ready` — the chart renders only in `ready` (FR-004/FR-005) |

## D. Geometry — `priceSeriesToChartData` (UNCHANGED)

`apps/mobile/src/utils/priceSeriesToChartData.ts` is reused as-is: `PricePoint[] → ChartPoint[]`, 30-day axis ending today, missing days emitted as `hideDataPoint` gap markers carrying the last-known value (never `0`), empty input → `[]`. Its co-located test is unchanged.

## E. Single-point crash guard (NEW — in `PriceTrendChart`, the only new logic)

The one behavioural addition, targeting the [#484 `data.length === 1` crash](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts/issues/484):

| Input series `data` | Passed to `LineChart` | Reason |
|---|---|---|
| `[]` | series omitted (not rendered) | empty source draws no line (handled upstream; `empty` status shows the annotation) |
| length 1 | **padded to 2 identical points** (flat line) | gifted-charts crashes on length 1 (#484) — FR-007 |
| length ≥ 2 | passed through unchanged | normal case |

Plus an **explicit finite `width`** is always passed (from `useWindowDimensions().width` − sheet padding) so the chart never auto-measures to `NaN`/`0` inside the native `formSheet` (FR-007). Both guards are pure render-time logic — no state, no effect.

## F. Lifecycle / state

No persisted state, no new store, no new query, no hook change. The chart is a stateless leaf (`FC`, props-only); `printingId` remains the `card-detail` route param (spec 020). This feature adds nothing to the state surface (Principle X — State locality).
