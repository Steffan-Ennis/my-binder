// Spec 020 — presentational sheet body (FR-001/002/004/005/007/008/009/010).
// `FC<CardDetailSheetViewProps>`, props-only: identity hero, the `− N +`
// ownership stepper, three price rows (MTG Goldfish a disabled "coming soon"
// placeholder), and the 30-day `<PriceTrendChart />`. Each data section maps
// its four-state status to skeleton (loading) / inline error + retry (failure,
// visually distinct from the empty annotation) / content. Styles live in
// `CardDetailSheetView.theme.ts`; the chart geometry + empty annotation are the
// chart's concern.
import { Image } from 'expo-image';
import type { FC } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import useStyles from './CardDetailSheetView.theme';
import type { CardDetailSheetViewProps, PriceRowModel } from './types';

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

const CardDetailSheetView: FC<CardDetailSheetViewProps> = ({
  name,
  setLabel,
  typeLine,
  oracle,
  imageUrl,
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
}) => {
  const styles = useStyles();

  return (
    <View style={styles.root} testID="card-detail-sheet">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close card details"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {imageUrl ? (
            <Image
              style={styles.heroImage}
              source={{ uri: imageUrl }}
              accessibilityLabel={name ? `${name} card image` : 'Card image'}
            />
          ) : (
            <View style={styles.heroImage} />
          )}
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
          {pricesStatus === 'loading' ? (
            <SectionSkeleton testID="prices-skeleton" rows={3} />
          ) : pricesStatus === 'error' ? (
            <RetryBlock
              message="Couldn’t load prices."
              retryLabel="Retry loading prices"
              onRetry={onRetryPrices}
            />
          ) : (
            priceRows.map((row) => <PriceRow key={row.key} row={row} />)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>30-DAY TREND</Text>
          {historyStatus === 'loading' ? (
            <SectionSkeleton testID="chart-skeleton" rows={4} />
          ) : historyStatus === 'error' ? (
            <RetryBlock
              message="Couldn’t load price history."
              retryLabel="Retry loading price history"
              onRetry={onRetryHistory}
            />
          ) : (
            <></>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default CardDetailSheetView;
