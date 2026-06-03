// Spec 021 — the re-introduced 30-day price-trend chart. A presentational leaf
// `FC` (props-only: no state, no effect, no fetch — Principle X). It renders one
// `react-native-gifted-charts` `LineChart` with Card Kingdom → `data` and TCG
// Player → `data2` (FR-001), framed by `30d ago`/`today` x-labels and `$min`/
// `$max` y-bounds (FR-002), with a 3-entry legend whose MTG Goldfish entry is a
// disabled "coming soon" placeholder that is never plotted (FR-003). Gap markers
// flow through from `priceSeriesToChartData` so a missing day reads as a gap, not
// a `$0` dip (FR-004). Source differentiation is colour-independent: every line
// and legend entry carries a text label and screen-reader exposure (FR-006).
//
// Two crash root-cause guards (the defect that made spec 020 defer the chart —
// FR-007): a series with a single observation is padded to two identical points
// before reaching `LineChart` (gifted-charts #484), and an explicit finite
// `width` is always passed so the chart never auto-measures to NaN/0 inside the
// native `formSheet`. Styles live in `PriceTrendChart.theme.ts`.
import type { FC } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import useStyles, {
  CHART_HEIGHT,
  MIN_CHART_WIDTH,
  SHEET_HORIZONTAL_PADDING,
  Y_AXIS_GUTTER,
} from './PriceTrendChart.theme';
import type { ChartPoint, ChartSeries, PriceTrendChartProps } from './types';

// gifted-charts #484: a length-1 dataset crashes the `LineChart`. Duplicate the
// lone observation so a flat line draws instead (FR-007).
const padToMinTwo = (data: ChartPoint[]): ChartPoint[] =>
  data.length === 1 ? [data[0]!, data[0]!] : data;

/**
 * Render the 30-day price-trend line chart for a printing's price history.
 *
 * Card Kingdom plots as the primary line (`data`) and TCG Player as the second
 * (`data2`); a source with no observations is omitted (no false-zero line). The
 * component is mounted by `CardDetailSheetView` only in the `ready` history
 * state, so `chartSeries` always holds 1–2 non-empty series.
 *
 * @param props - `{ chartSeries, chartLegend }` from `useCardDetailSheet`.
 * @returns the chart, axis labels, and legend as a presentational tree.
 *
 * @example
 *   <PriceTrendChart chartSeries={chartSeries} chartLegend={chartLegend} />
 */
const PriceTrendChart: FC<PriceTrendChartProps> = ({ chartSeries, chartLegend }) => {
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();

  // Explicit, always-finite width — never rely on gifted-charts' auto-measure
  // inside the native formSheet, which can resolve to NaN/0 on first layout.
  const chartWidth = Math.max(
    windowWidth - SHEET_HORIZONTAL_PADDING - Y_AXIS_GUTTER,
    MIN_CHART_WIDTH,
  );

  // Card Kingdom is the primary line, TCG Player the second. The hook adds a
  // source to `chartSeries` only when it has ≥1 observation, and mounts this
  // chart only in the `ready` state — so `ordered` always holds 1–2 non-empty
  // series (a source with no data is never plotted → no false-zero line, AS4;
  // the all-empty shape is owned by the view's `empty` branch, not the chart).
  const cardKingdom = chartSeries.find((s) => s.key === 'cardKingdom');
  const tcgPlayer = chartSeries.find((s) => s.key === 'tcgPlayer');
  const ordered = [cardKingdom, tcgPlayer].filter((s): s is ChartSeries => Boolean(s));

  const data = padToMinTwo(ordered[0]!.data);
  const data2 = ordered[1] ? padToMinTwo(ordered[1].data) : undefined;

  // y-bounds frame the observed range; floor/ceil to whole dollars (the design
  // framing, e.g. $13 → $20). Padding never shifts min/max (it duplicates a
  // value already in the series).
  const values = chartSeries.flatMap((s) => s.data.map((p) => p.value));
  const minDollars = Math.floor(Math.min(...values));
  const maxDollars = Math.ceil(Math.max(...values));

  return (
    <View
      style={styles.container}
      accessibilityRole="image"
      accessibilityLabel="30-day price trend chart"
    >
      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{`$${maxDollars}`}</Text>
          <Text style={styles.axisLabel}>{`$${minDollars}`}</Text>
        </View>
        <LineChart
          data={data}
          data2={data2}
          color={ordered[0]!.color}
          color2={ordered[1]?.color}
          width={chartWidth}
          height={CHART_HEIGHT}
          thickness={2}
          hideYAxisText
          hideAxesAndRules
          yAxisOffset={minDollars}
          maxValue={maxDollars}
        />
      </View>

      <View style={styles.xAxisRow}>
        <Text style={styles.axisLabel}>30d ago</Text>
        <Text style={styles.axisLabel}>today</Text>
      </View>

      <View style={styles.legendRow}>
        {chartLegend.map((entry) => (
          <View
            key={entry.label}
            style={styles.legendEntry}
            accessibilityRole="text"
            accessibilityLabel={
              entry.disabled ? `${entry.label} coming soon` : `${entry.label} price trend`
            }
            accessibilityState={{ disabled: entry.disabled }}
          >
            {entry.disabled ? null : (
              <View style={[styles.legendSwatch, { backgroundColor: entry.color }]} />
            )}
            <Text style={[styles.legendLabel, entry.disabled && styles.legendLabelDisabled]}>
              {entry.label}
            </Text>
            {entry.disabled ? <Text style={styles.legendComingSoon}>coming soon</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
};

export default PriceTrendChart;
