// Spec 020 — feature hook for the Card Detail Sheet (Principle X: the only
// stateful/effectful layer). Composes the three per-endpoint query hooks
// (detail / prices / history), derives the view models (price rows, chart
// series, four-state section statuses), and exposes the stepper + retry + close
// handlers. Every returned non-primitive is memoised (Principle X v1.16.0).
//
// Stepper ⇄ spec 019: the ownership mutation is owned by spec
// `019-binder-add-remove` (`useUpdateBinderEntryMutation`), which is not yet
// merged. Until then the stepper is driven by a minimal local `useMutation`
// over the existing `apiClient.patchCard`; per FR-011 it invalidates ONLY
// `['cards','detail', printingId]` on success via the built-in
// `queryClient.invalidateQueries` (invalidate-only — no optimistic update, no
// hand-rolled cache reconciliation). When spec 019 lands, swap this local
// mutation for its hook, keeping the same detail-key invalidation.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useCardDetailQuery } from '@src/hooks/useCardDetailQuery';
import { useCardPriceHistoryQuery } from '@src/hooks/useCardPriceHistoryQuery';
import { useCardPricesQuery } from '@src/hooks/useCardPricesQuery';
import { apiClient } from '@src/services/api/apiClient';
import { Colors } from '@src/constants/theme';
import { priceSeriesToChartData } from '@src/utils/priceSeriesToChartData';

import type {
  CardDetailSheetViewProps,
  ChartLegendEntry,
  ChartSeries,
  PriceRowModel,
  SectionStatus,
  UseCardDetailSheetOptions,
} from './types';

// Source → theme swatch (gold / muted / rose). Paired with text labels in the
// view so sources are never distinguished by colour alone (FR-010).
const SOURCE_COLOR = {
  cardKingdom: Colors.dark.accent,
  mtgGoldfish: Colors.dark.textMuted,
  tcgPlayer: Colors.dark.text,
} as const;

// The legend is invariant: three entries, MTG Goldfish always a disabled
// "coming soon" placeholder with no plotted line (FR-003). Module-level so it
// is referentially stable for free.
const CHART_LEGEND: ChartLegendEntry[] = [
  { label: 'Card Kingdom', color: SOURCE_COLOR.cardKingdom, disabled: false },
  { label: 'MTG Goldfish', color: SOURCE_COLOR.mtgGoldfish, disabled: true },
  { label: 'TCG Player', color: SOURCE_COLOR.tcgPlayer, disabled: false },
];

const formatQuote = (quote: { amountCents: number } | null | undefined): string =>
  quote ? `$${(quote.amountCents / 100).toFixed(2)}` : '—';

export type UseCardDetailSheetResult = CardDetailSheetViewProps;

/**
 * Compose the detail/prices/history queries for one printing and shape them
 * into the `CardDetailSheetView` prop bundle (spec 020 / US1).
 *
 * @param options - `{ printingId }`, the tapped printing's MTGJSON UUID.
 * @returns the documented `CardDetailSheetViewProps`.
 *
 * @example
 *   const props = useCardDetailSheet({ printingId });
 *   return <CardDetailSheetView {...props} />;
 */
const useCardDetailSheet = ({ printingId }: UseCardDetailSheetOptions): UseCardDetailSheetResult => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const detailQuery = useCardDetailQuery(printingId);
  const pricesQuery = useCardPricesQuery(printingId);
  const historyQuery = useCardPriceHistoryQuery(printingId);

  const { mutate } = useMutation({
    mutationFn: (delta: 1 | -1) => apiClient.patchCard(printingId, { delta }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cards', 'detail', printingId] });
    },
  });

  const numberOwned = detailQuery.data?.numberOwned ?? 0;
  const canDecrement = numberOwned > 0;

  const setLabel = useMemo<string | undefined>(() => {
    const card = detailQuery.data;
    if (!card) return undefined;
    if (card.setName && card.setCode) return `${card.setName} · ${card.setCode}`;
    return card.setName ?? card.setCode ?? undefined;
  }, [detailQuery.data]);

  const priceRows = useMemo<PriceRowModel[]>(() => {
    const prices = pricesQuery.data;
    return [
      {
        key: 'cardKingdom',
        label: 'Card Kingdom',
        display: formatQuote(prices?.cardKingdom),
        swatchColor: SOURCE_COLOR.cardKingdom,
        disabled: false,
      },
      {
        key: 'mtgGoldfish',
        label: 'MTG Goldfish',
        display: 'Coming soon',
        swatchColor: SOURCE_COLOR.mtgGoldfish,
        disabled: true,
      },
      {
        key: 'tcgPlayer',
        label: 'TCG Player',
        display: formatQuote(prices?.tcgPlayer),
        swatchColor: SOURCE_COLOR.tcgPlayer,
        disabled: false,
      },
    ];
  }, [pricesQuery.data]);

  const chartSeries = useMemo<ChartSeries[]>(() => {
    const history = historyQuery.data;
    if (!history) return [];
    const series: ChartSeries[] = [];
    const cardKingdomData = priceSeriesToChartData(history.cardKingdom, { days: history.days });
    if (cardKingdomData.length > 0) {
      series.push({
        key: 'cardKingdom',
        label: 'Card Kingdom',
        color: SOURCE_COLOR.cardKingdom,
        data: cardKingdomData,
      });
    }
    const tcgPlayerData = priceSeriesToChartData(history.tcgPlayer, { days: history.days });
    if (tcgPlayerData.length > 0) {
      series.push({
        key: 'tcgPlayer',
        label: 'TCG Player',
        color: SOURCE_COLOR.tcgPlayer,
        data: tcgPlayerData,
      });
    }
    return series;
  }, [historyQuery.data]);

  const pricesStatus: SectionStatus = pricesQuery.isError
    ? 'error'
    : !pricesQuery.data
      ? 'loading'
      : pricesQuery.data.cardKingdom === null && pricesQuery.data.tcgPlayer === null
        ? 'empty'
        : 'ready';

  const historyStatus: SectionStatus = historyQuery.isError
    ? 'error'
    : !historyQuery.data
      ? 'loading'
      : historyQuery.data.cardKingdom.length === 0 && historyQuery.data.tcgPlayer.length === 0
        ? 'empty'
        : 'ready';

  const { refetch: refetchPrices } = pricesQuery;
  const { refetch: refetchHistory } = historyQuery;

  const onIncrement = useCallback(() => {
    mutate(1);
  }, [mutate]);

  const onDecrement = useCallback(() => {
    if (canDecrement) mutate(-1);
  }, [mutate, canDecrement]);

  const onRetryPrices = useCallback(() => {
    void refetchPrices();
  }, [refetchPrices]);

  const onRetryHistory = useCallback(() => {
    void refetchHistory();
  }, [refetchHistory]);

  const onClose = useCallback(() => {
    router.back();
  }, [router]);

  return useMemo<UseCardDetailSheetResult>(
    () => ({
      id: printingId,
      error: detailQuery.error,
      isLoading: detailQuery.isLoading,
      isSuccess: detailQuery.isSuccess,
      name: detailQuery.data?.name,
      setLabel,
      typeLine: detailQuery.data?.typeLine,
      oracle: detailQuery.data?.oracle,
      numberOwned,
      canDecrement,
      onIncrement,
      onDecrement,
      priceRows,
      pricesStatus,
      onRetryPrices,
      chartSeries,
      chartLegend: CHART_LEGEND,
      historyStatus,
      onRetryHistory,
      onClose,
    }),
    [
      detailQuery.error,
      detailQuery.isLoading,
      detailQuery.isSuccess,
      detailQuery.data?.name,
      detailQuery.data?.typeLine,
      setLabel,
      numberOwned,
      canDecrement,
      onIncrement,
      onDecrement,
      priceRows,
      pricesStatus,
      onRetryPrices,
      chartSeries,
      historyStatus,
      onRetryHistory,
      onClose,
      printingId,
    ],
  );
};

export default useCardDetailSheet;
