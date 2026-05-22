// Spec 020 — Container layer (Principle X). Calls the feature hook and bridges
// its result to the presentational view by passing each field as a named prop
// (no spread), so the view's prop surface stays explicit and reviewable. The
// `printingId` is supplied by the `card-detail` form-sheet route param.
import type { FC } from 'react';

import CardDetailSheetView from './CardDetailSheetView';
import useCardDetailSheet from './useCardDetailSheet';

const CardDetailSheetContainer: FC<{ printingId: string }> = ({ printingId }) => {
  const {
    error,
    isLoading,
    isSuccess,
    name,
    setLabel,
    typeLine,
    oracle,
    numberOwned,
    canDecrement,
    onIncrement,
    onDecrement,
    priceRows,
    pricesStatus,
    onRetryPrices,
    chartSeries,
    chartLegend,
    historyStatus,
    onRetryHistory,
    onClose,
  } = useCardDetailSheet({ printingId });

  return (
    <CardDetailSheetView
      id={printingId}
      error={error}
      isLoading={isLoading}
      isSuccess={isSuccess}
      name={name}
      setLabel={setLabel}
      typeLine={typeLine}
      oracle={oracle}
      numberOwned={numberOwned}
      canDecrement={canDecrement}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
      priceRows={priceRows}
      pricesStatus={pricesStatus}
      onRetryPrices={onRetryPrices}
      chartSeries={chartSeries}
      chartLegend={chartLegend}
      historyStatus={historyStatus}
      onRetryHistory={onRetryHistory}
      onClose={onClose}
    />
  );
};

export default CardDetailSheetContainer;
