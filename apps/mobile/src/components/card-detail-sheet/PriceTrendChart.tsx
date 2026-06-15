// Spec 021 — the re-introduced 30-day price-trend chart. A presentational leaf
// `FC` (props-only: no state, no effect, no fetch — Principle X). It renders one
// `react-native-gifted-charts` `LineChart` with Card Kingdom → `data` and TCG
// Player → `data2` (FR-001). The chart uses the library's NATIVE axes so the
// labels align to the plot: a rotated `M/D` date tick under every day (the
// per-point `label` flows from `priceSeriesToChartData`), and 6 evenly-spaced
// dollar labels up the y-axis (FR-002). A 3-entry legend carries the disabled
// "coming soon" MTG Goldfish placeholder that is never plotted (FR-003). Gap
// markers flow through from `priceSeriesToChartData` so a missing day reads as a
// gap, not a `$0` dip (FR-004). Source differentiation is colour-independent:
// every line and legend entry carries a text label and screen-reader exposure
// (FR-006).
//
// Two crash root-cause guards (the defect that made spec 020 defer the chart —
// FR-007): a series with a single observation is padded to two identical points
// before reaching `LineChart` (gifted-charts #484), and an explicit finite
// `width` (+ `adjustToWidth`/`disableScroll`) is always passed so the chart
// never auto-measures to NaN/0 inside the native `formSheet` and every day fits
// without horizontal scroll. Styles live in `PriceTrendChart.theme.ts`.
import type { FC } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import useStyles, {
  CHART_HEIGHT,
  INITIAL_SPACING,
  MIN_CHART_WIDTH,
  NO_OF_SECTIONS,
  SHEET_HORIZONTAL_PADDING,
  X_AXIS_COLOR,
  X_AXIS_LABELS_HEIGHT,
  Y_AXIS_LABEL_WIDTH,
} from './PriceTrendChart.theme';
import type { ChartPoint, ChartSeries, PriceTrendChartProps } from './types';

// gifted-charts #484: a length-1 dataset crashes the `LineChart`. Duplicate the
// lone observation so a flat line draws instead (FR-007).
const padToMinTwo = (data: ChartPoint[]): ChartPoint[] =>
  data.length === 1 ? [data[0]!, data[0]!] : data;

// Round a positive number up to the nearest "nice" whole-dollar step (1, 2, 5 ×
// 10ⁿ) so y-axis labels land on clean values rather than arbitrary fractions.
const niceCeil = (x: number): number => {
  if (x <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
};

// Next "nice" step after a nice value: 1→2→5→10→20→… Used to widen the band
// when 5 sections of the current step can't reach `max` from a round baseline.
const niceNext = (step: number): number => {
  const pow = Math.pow(10, Math.floor(Math.log10(step)));
  const n = Math.round(step / pow);
  if (n === 1) return 2 * pow;
  if (n === 2) return 5 * pow;
  return 10 * pow;
};

type YAxis = { offset: number; maxValue: number; stepValue: number; labels: string[] };

// Build a 6-label (5-section) y-axis that frames the observed range with a clean
// whole-dollar step. The baseline is the largest step-multiple ≤ min; if 5
// sections from there can't cover max, the step grows to the next nice value
// (which also adds headroom) — so the top point never clips and every label
// stays a round multiple. Returns the props gifted-charts needs: `offset`
// (baseline value), `maxValue`/`stepValue` (offset-relative — the library plots
// `value − offset`), and the 6 label texts ordered bottom→top.
const computeYAxis = (values: number[]): YAxis => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  let step = Math.max(1, niceCeil((max - min) / NO_OF_SECTIONS));
  let offset = Math.floor(min / step) * step;
  while (offset + step * NO_OF_SECTIONS < max) {
    step = niceNext(step);
    offset = Math.floor(min / step) * step;
  }
  const labels = Array.from({ length: NO_OF_SECTIONS + 1 }, (_, i) => `$${offset + step * i}`);
  return { offset, maxValue: step * NO_OF_SECTIONS, stepValue: step, labels };
};

/**
 * Render the 30-day price-trend line chart for a printing's price history.
 *
 * Card Kingdom plots as the primary line (`data`) and TCG Player as the second
 * (`data2`); a source with no observations is omitted (no false-zero line). The
 * component is mounted by `CardDetailSheetView` only in the `ready` history
 * state, so `chartSeries` always holds 1–2 non-empty series.
 *
 * @param props - `{ chartSeries, chartLegend }` from `useCardDetailSheet`.
 * @returns the chart, dated axes, and legend as a presentational tree.
 *
 * @example
 *   <PriceTrendChart chartSeries={chartSeries} chartLegend={chartLegend} />
 */
const PriceTrendChart: FC<PriceTrendChartProps> = ({ chartSeries, chartLegend }) => {
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();

  // Explicit, always-finite plot width — never rely on gifted-charts'
  // auto-measure inside the native formSheet, which can resolve to NaN/0 on
  // first layout. `adjustToWidth` fits all days into this width (no scroll).
  const chartWidth = Math.max(
    windowWidth - SHEET_HORIZONTAL_PADDING - Y_AXIS_LABEL_WIDTH,
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

  // y-axis: 6 evenly-spaced whole-dollar labels framing the observed range.
  // Padding never shifts min/max (it duplicates a value already in the series).
  const values = chartSeries.flatMap((s) => s.data.map((p) => p.value));
  const yAxis = computeYAxis(values);

  return (
    <View
      style={styles.container}
      accessibilityRole="image"
      accessibilityLabel="30-day price trend chart"
    >
      <LineChart
        data={data}
        data2={data2}
        color={ordered[0]!.color}
        color2={ordered[1]?.color}
        dataPointsColor={ordered[0]!.color}
        dataPointsColor2={ordered[1]?.color}
        width={chartWidth}
        height={CHART_HEIGHT}
        thickness={2}
        adjustToWidth
        disableScroll
        initialSpacing={INITIAL_SPACING}
        endSpacing={0}
        hideRules
        // y-axis — 6 evenly-spaced dollar labels (FR-002).
        yAxisOffset={yAxis.offset}
        maxValue={yAxis.maxValue}
        stepValue={yAxis.stepValue}
        noOfSections={NO_OF_SECTIONS}
        yAxisLabelTexts={yAxis.labels}
        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
        yAxisThickness={0}
        yAxisColor="transparent"
        yAxisTextStyle={styles.yAxisLabelText}
        // x-axis — one rotated M/D date tick per day (FR-002). Labels ride on
        // each point's `label` (from `priceSeriesToChartData`).
        rotateLabel
        xAxisLabelTextStyle={styles.xAxisLabelText}
        xAxisLabelsHeight={X_AXIS_LABELS_HEIGHT}
        xAxisLabelsVerticalShift={8}
        xAxisThickness={1}
        xAxisColor={X_AXIS_COLOR}
      />

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
