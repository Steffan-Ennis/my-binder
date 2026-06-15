// Spec 021 — style tokens for the re-introduced price-trend chart (Style
// co-location: no inline `StyleSheet.create` in `PriceTrendChart.tsx`). Sourced
// from the global theme so the chart inherits the binder's dark surface. The
// layout constants live here too so the chart's explicit `width` math (FR-007)
// and native-axis config read from one source rather than scattering magic
// numbers. The axis text styles below are handed to `react-native-gifted-charts`
// (`xAxisLabelTextStyle` / `yAxisTextStyle`) so the library draws the dated
// x-axis ticks and the 6 evenly-spaced y-axis labels in the binder's palette.
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@src/constants/theme';

// Plot height (px) — the line/area region, excluding the x-axis label band.
export const CHART_HEIGHT = 180;
// Width reserved (inside the chart) for the native y-axis label column. Wide
// enough for `$10`-class labels in the caption font.
export const Y_AXIS_LABEL_WIDTH = 44;
// Vertical band reserved below the plot for the rotated `M/D` date labels.
export const X_AXIS_LABELS_HEIGHT = 38;
// Gap before the first plotted point so the oldest date label clears the y-axis.
export const INITIAL_SPACING = 4;
// 5 sections → 6 evenly-spaced horizontal y-axis labels (per the design ask).
export const NO_OF_SECTIONS = 5;
// Floor so the explicit plot `width` is never ≤ 0 even if `useWindowDimensions`
// reports 0 on first layout inside the native `formSheet` (FR-007).
export const MIN_CHART_WIDTH = 160;
// The detail sheet's `scroll` content padding is `Spacing.lg` on each side
// (see CardDetailSheetView.theme.ts) — subtracted from the window width.
export const SHEET_HORIZONTAL_PADDING = Spacing.lg * 2;
// Hairline baseline under the date labels — subtle, anchors the x-axis.
export const X_AXIS_COLOR = Colors.dark.border;

export type PriceTrendChartStyles = {
  container: Required<Pick<ViewStyle, 'gap' | 'paddingTop'>>;
  xAxisLabelText: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color'>>;
  yAxisLabelText: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color'>>;
  legendRow: Required<
    Pick<ViewStyle, 'flexDirection' | 'flexWrap' | 'alignItems' | 'gap' | 'paddingTop'>
  >;
  legendEntry: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'gap'>>;
  legendSwatch: Required<Pick<ViewStyle, 'width' | 'height' | 'borderRadius'>>;
  legendLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  legendLabelDisabled: Required<Pick<TextStyle, 'color'>>;
  legendComingSoon: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontStyle'>>;
};

const styles = StyleSheet.create<PriceTrendChartStyles>({
  container: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  // Tiny rotated date ticks — one per day, so they must stay compact.
  xAxisLabelText: {
    fontFamily: Type.caption.font,
    fontSize: 9,
    color: Colors.dark.textMuted,
  },
  yAxisLabelText: {
    fontFamily: Type.caption.font,
    fontSize: Type.caption.size,
    color: Colors.dark.textMuted,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  legendEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: Radius.sm,
  },
  legendLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.textInverted,
    fontWeight: Type.bodyStrong.weight,
  },
  legendLabelDisabled: {
    color: Colors.dark.textMuted,
  },
  legendComingSoon: {
    fontFamily: Type.caption.font,
    fontSize: Type.caption.size,
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
});

export type { PriceTrendChartStyles as Styles };

const useStyles = (): PriceTrendChartStyles => styles;

export default useStyles;
