// Spec 020 / 021 — presentational sheet body (FR-001/002/004/007/008/009/010).
// `FC<CardDetailSheetViewProps>`, props-only: identity hero, the `− N +`
// ownership stepper, and three price rows (MTG Goldfish a disabled "coming
// soon" placeholder). Each data section maps its four-state status to skeleton
// (loading) / inline error + retry (failure, visually distinct from the empty
// annotation) / content. Dismissal is the form-sheet's native swipe-down.
//
// Spec 021 re-introduced the 30-day price-trend CHART: the section's `ready`
// branch now renders <PriceTrendChart/> from the hook-supplied `chartSeries` /
// `chartLegend`. The loading / error / "no recent price data" (FR-004) states
// are unchanged. Styles live in `CardDetailSheetView.theme.ts`.
import type { FC } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import useStyles from './CardDetailSheetView.theme';
import PriceTrendChart from './PriceTrendChart';
import type {
  CardDetailSheetViewProps,
  ChartLegendEntry,
  ChartSeries,
  PriceRowModel,
  SectionStatus,
} from './types';
import CardContainer from "@src/components/card/CardContainer";

const RetryBlock: FC<{ message: string; retryLabel: string; onRetry: () => void }> = ({
  message,
  retryLabel,
  onRetry,
}) => {
  const styles = useStyles();
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        onPress={onRetry}
        style={styles.retryButton}
      >
        <Text style={styles.retryLabel}>Retry</Text>
      </Pressable>
    </View>
  );
};

const SectionSkeleton: FC<{ testID: string; rows: number }> = ({ testID, rows }) => {
  const styles = useStyles();
  return (
    <View testID={testID} style={styles.section}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.skeleton} />
      ))}
    </View>
  );
};

const PriceRow: FC<{ row: PriceRowModel }> = ({ row }) => {
  const styles = useStyles();
  return (
    <View
      testID={`price-row-${row.key}`}
      style={styles.priceRow}
      accessibilityRole="text"
      accessibilityLabel={`${row.label}: ${row.display}`}
      accessibilityState={{ disabled: row.disabled }}
    >
      <View style={styles.priceRowLabelGroup}>
        <View style={[styles.priceSwatch, { backgroundColor: row.swatchColor }]} />
        <Text style={[styles.priceLabel, row.disabled && styles.priceLabelDisabled]}>
          {row.label}
        </Text>
      </View>
      <Text style={[styles.priceValue, row.disabled && styles.priceValueDisabled]}>
        {row.display}
      </Text>
    </View>
  );
};

// PRICES section body — maps the four-state status to skeleton / retry / rows
// via early returns (no nested ternary, no render function).
const PricesSection: FC<{
  status: SectionStatus;
  priceRows: PriceRowModel[];
  onRetry: () => void;
}> = ({ status, priceRows, onRetry }) => {
  if (status === 'loading') {
    return <SectionSkeleton testID="prices-skeleton" rows={3} />;
  }
  if (status === 'error') {
    return (
      <RetryBlock
        message="Couldn’t load prices."
        retryLabel="Retry loading prices"
        onRetry={onRetry}
      />
    );
  }
  return (
    <>
      {priceRows.map((row) => (
        <PriceRow key={row.key} row={row} />
      ))}
    </>
  );
};

// 30-DAY TREND section body — skeleton / retry / empty annotation / chart
// (FR-004) via early returns (no nested ternary, no render function).
const TrendSection: FC<{
  status: SectionStatus;
  chartSeries: ChartSeries[];
  chartLegend: ChartLegendEntry[];
  onRetry: () => void;
}> = ({ status, chartSeries, chartLegend, onRetry }) => {
  const styles = useStyles();
  if (status === 'loading') {
    return <SectionSkeleton testID="chart-skeleton" rows={4} />;
  }
  if (status === 'error') {
    return (
      <RetryBlock
        message="Couldn’t load price history."
        retryLabel="Retry loading price history"
        onRetry={onRetry}
      />
    );
  }
  if (status === 'empty') {
    return <Text style={styles.trendPlaceholder}>no recent price data</Text>;
  }
  return <PriceTrendChart chartSeries={chartSeries} chartLegend={chartLegend} />;
};

const CardDetailSheetView: FC<CardDetailSheetViewProps> = ({
  id,
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
}) => {
  const styles = useStyles();

  return (
    <View style={styles.root} testID="card-detail-sheet">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <CardContainer
            footprint={'pocket'}
            id={id}
          />
          <View style={styles.heroText}>
            {name ? <Text style={styles.name}>{name}</Text> : null}
            {setLabel ? <Text style={styles.setLabel}>{setLabel}</Text> : null}
            {typeLine ? <Text style={styles.typeLine}>{typeLine}</Text> : null}
            {oracle ? <Text style={styles.oracle}>{oracle}</Text> : null}
          </View>
        </View>

        <View style={styles.stepperBlock}>
          <Text style={styles.sectionTitle}>IN YOUR BINDER</Text>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove one copy"
              accessibilityState={{ disabled: !canDecrement }}
              disabled={!canDecrement}
              onPress={onDecrement}
              style={[styles.stepperButton, !canDecrement && styles.stepperButtonDisabled]}
            >
              <Text style={styles.stepperGlyph}>−</Text>
            </Pressable>
            <Text testID="stepper-count" style={styles.stepperCount}>
              {numberOwned}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add one copy"
              onPress={onIncrement}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperGlyph}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRICES</Text>
          <PricesSection status={pricesStatus} priceRows={priceRows} onRetry={onRetryPrices} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>30-DAY TREND</Text>
          <TrendSection
            status={historyStatus}
            chartSeries={chartSeries}
            chartLegend={chartLegend}
            onRetry={onRetryHistory}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default CardDetailSheetView;
