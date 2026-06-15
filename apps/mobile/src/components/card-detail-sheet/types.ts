// Spec 020 — mobile-only view models for the Card Detail Sheet.
//
// These never cross the wire (Principle X rule 7); the wire shapes
// (`Card`, `CardPricesResponse`, `CardPriceHistoryResponse`) live once in
// `@my-binder/core` and are re-used here. View props are `Pick`'d from the
// query result type (Principle X rule 5) so the view inherits TanStack's
// authoritative `error` / `isLoading` / `isSuccess` typing rather than
// redeclaring it.
import type { Card } from '@my-binder/core';
import type { UseQueryResult } from '@tanstack/react-query';

import type { ApiError } from '@src/services/api/ApiError';

// The detail query result the sheet hangs its identity section off of. The
// Phase-B `useCardDetailQuery` resolves to exactly this shape; aliasing it
// here keeps `types.ts` independent of the hook during the mock-first phase.
export type CardDetailQueryResult = UseQueryResult<Card, ApiError>;

// Four-state status shared by the price-rows section and the chart section.
// `loading` → skeleton (FR-008); `error` → inline error + retry (FR-009);
// `empty` → "no recent price data" annotation (FR-004); `ready` → data shown.
export type SectionStatus = 'loading' | 'error' | 'empty' | 'ready';

// One rendered price row. Three are built every time: Card Kingdom (live),
// MTG Goldfish (disabled "coming soon" placeholder), TCG Player (live).
export type PriceRowModel = {
  key: 'cardKingdom' | 'mtgGoldfish' | 'tcgPlayer';
  label: 'Card Kingdom' | 'MTG Goldfish' | 'TCG Player';
  // '$17.23' for a live quote, '—' for a missing live quote, 'Coming soon'
  // for the disabled Goldfish placeholder (FR-002 / FR-004).
  display: string;
  // Theme token paired with the text label — never colour-alone (FR-010).
  swatchColor: string;
  // true ONLY for the MTG Goldfish "coming soon" placeholder.
  disabled: boolean;
};

// One point on a plotted line. `hideDataPoint` marks a synthetic gap day
// (FR-004) so the line never dips to a false zero.
export type ChartPoint = { value: number; label?: string; hideDataPoint?: boolean };

// One plotted line. MTG Goldfish is NEVER a series (FR-003).
export type ChartSeries = {
  key: 'cardKingdom' | 'tcgPlayer';
  label: 'Card Kingdom' | 'TCG Player';
  color: string;
  // gifted-charts data, 30-day aligned, gap markers for missing days.
  data: ChartPoint[];
};

// Legend entry — three entries; the Goldfish entry is disabled with no line.
export type ChartLegendEntry = { label: string; color: string; disabled: boolean };

// Spec 021 — props for the re-created presentational price-trend chart. The
// chart consumes the (unchanged) hook-derived view models directly.
export type PriceTrendChartProps = {
  chartSeries: ChartSeries[]; // 0–2 live series (MTG Goldfish never present)
  chartLegend: ChartLegendEntry[]; // exactly 3 entries (CK, Goldfish disabled, TCGP)
};

// Hook options (Principle X rule 6).
export type UseCardDetailSheetOptions = { printingId: string };

// Props supplied by `useCardDetailSheet` to `CardDetailSheetView`.
export type CardDetailSheetViewProps = Pick<
  CardDetailQueryResult,
  'error' | 'isLoading' | 'isSuccess'
> & {
  // Identity (FR-001) — optional until the detail query resolves.
  name?: string;
  setLabel?: string;
  typeLine?: string;
  oracle?: string;
  id: string;

  // Ownership stepper (FR-007).
  numberOwned: number;
  canDecrement: boolean;
  onIncrement: () => void;
  onDecrement: () => void;

  // Prices (FR-002).
  priceRows: PriceRowModel[];
  pricesStatus: SectionStatus; // FR-008 skeleton / FR-009 error / FR-004 empty
  onRetryPrices: () => void;

  // Trend (FR-003 / FR-004).
  chartSeries: ChartSeries[];
  chartLegend: ChartLegendEntry[];
  historyStatus: SectionStatus;
  onRetryHistory: () => void;

  // Sheet (FR-005).
  onClose: () => void;
};
