// Spec 021 — style tokens for the re-introduced price-trend chart (Style
// co-location: no inline `StyleSheet.create` in `PriceTrendChart.tsx`). Sourced
// from the global theme so the chart inherits the binder's dark surface. The
// layout constants (`CHART_HEIGHT`, `Y_AXIS_GUTTER`, `MIN_CHART_WIDTH`,
// `SHEET_HORIZONTAL_PADDING`) live here too so the chart's explicit `width`
// math (FR-007) reads from one source rather than scattering magic numbers.
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@src/constants/theme';

// Plot height (px). The y-axis label column matches it so `$max`/`$min` frame
// the plotted range top/bottom.
export const CHART_HEIGHT = 180;
// Horizontal space reserved for the y-axis label column + its gap.
export const Y_AXIS_GUTTER = 48;
// Floor so the explicit `width` is never ≤ 0 even if `useWindowDimensions`
// reports 0 on first layout inside the native `formSheet` (FR-007).
export const MIN_CHART_WIDTH = 160;
// The detail sheet's `scroll` content padding is `Spacing.lg` on each side
// (see CardDetailSheetView.theme.ts) — subtracted from the window width.
export const SHEET_HORIZONTAL_PADDING = Spacing.lg * 2;

export type PriceTrendChartStyles = {
  container: Required<Pick<ViewStyle, 'gap' | 'paddingTop'>>;
  chartRow: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'gap'>>;
  yAxis: Required<Pick<ViewStyle, 'height' | 'justifyContent' | 'alignItems'>>;
  axisLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color'>>;
  xAxisRow: Required<Pick<ViewStyle, 'flexDirection' | 'justifyContent' | 'marginLeft'>>;
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
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  yAxis: {
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  axisLabel: {
    fontFamily: Type.caption.font,
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    color: Colors.dark.textMuted,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: Y_AXIS_GUTTER,
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
