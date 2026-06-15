import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@src/constants/theme';

export type CatalogueViewStyles = {
  root: Required<Pick<ViewStyle, 'flex' | 'backgroundColor'>>;
  canvas: Required<
    Pick<
      ViewStyle,
      'flex' | 'backgroundColor' | 'paddingHorizontal' | 'paddingTop' | 'paddingBottom'
    >
  >;
  summaryCaption: Required<
    Pick<
      TextStyle,
      | 'fontFamily'
      | 'fontSize'
      | 'lineHeight'
      | 'letterSpacing'
      | 'color'
      | 'textAlign'
      | 'marginBottom'
      | 'fontWeight'
    >
  >;
  binderPage: Required<
    Pick<ViewStyle, 'flex' | 'backgroundColor' | 'borderRadius' | 'padding' | 'paddingLeft'>
  >;
  ringColumn: Required<
    Pick<ViewStyle, 'position' | 'left' | 'top' | 'bottom' | 'justifyContent' | 'paddingVertical'>
  >;
  ring: Required<Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor'>>;
  grid: Required<
    Pick<ViewStyle, 'flex' | 'flexDirection' | 'flexWrap' | 'justifyContent' | 'alignContent'>
  >;
  pocket: Required<
    Pick<
      ViewStyle,
      'width' | 'height' | 'aspectRatio' | 'borderRadius' | 'overflow' | 'marginBottom'
    >
  >;
  pocketEmpty: Required<
    Pick<ViewStyle, 'borderWidth' | 'borderStyle' | 'borderColor' | 'backgroundColor'>
  >;
  pocketSkeleton: Required<Pick<ViewStyle, 'backgroundColor'>>;
  pageNavigator: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingTop'>
  >;
  pageOf: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'fontWeight'
    >
  >;
  // Filter-pill row in the masthead slot.
  filterPillRow: Required<
    Pick<ViewStyle, 'flexDirection' | 'flexWrap' | 'gap' | 'paddingHorizontal' | 'paddingBottom'>
  >;
  filterPillRowSingle: Required<
    Pick<ViewStyle, 'flexDirection' | 'paddingHorizontal' | 'paddingBottom'>
  >;
  filterPill: Required<
    Pick<
      ViewStyle,
      | 'paddingHorizontal'
      | 'paddingVertical'
      | 'borderRadius'
      | 'backgroundColor'
      | 'flexDirection'
      | 'alignItems'
      | 'gap'
    >
  >;
  filterPillLabel: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>
  >;
  filterPillIcon: Required<Pick<TextStyle, 'color'>>;
  filterOpenerPill: Required<
    Pick<
      ViewStyle,
      | 'paddingHorizontal'
      | 'paddingVertical'
      | 'borderRadius'
      | 'borderWidth'
      | 'borderColor'
      | 'flexDirection'
      | 'alignItems'
      | 'gap'
    >
  >;
  filterOpenerLabel: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>
  >;
  filterOpenerIcon: Required<Pick<TextStyle, 'color'>>;
  // Pocket overlay layer (US4) — wraps Card so the glyph buttons sit on top.
  pocketWrapper: Required<
    Pick<ViewStyle, 'width' | 'aspectRatio' | 'marginBottom' | 'position'>
  >;
  pocketActionAdd: Required<
    Pick<
      ViewStyle,
      | 'position'
      | 'bottom'
      | 'right'
      | 'width'
      | 'height'
      | 'borderRadius'
      | 'backgroundColor'
      | 'alignItems'
      | 'justifyContent'
    >
  >;
  pocketActionAddIcon: Required<Pick<TextStyle, 'color'>>;
  pocketOwnedGlyph: Required<
    Pick<
      ViewStyle,
      | 'position'
      | 'top'
      | 'right'
      | 'paddingHorizontal'
      | 'paddingVertical'
      | 'borderRadius'
      | 'backgroundColor'
    >
  >;
  pocketOwnedGlyphLabel: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>
  >;
  refreshHint: Required<
    Pick<
      ViewStyle,
      | 'marginBottom'
      | 'paddingHorizontal'
      | 'paddingVertical'
      | 'borderRadius'
      | 'borderWidth'
      | 'borderColor'
      | 'backgroundColor'
      | 'alignItems'
      | 'justifyContent'
    >
  >;
  refreshHintLabel: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight' | 'textAlign'>
  >;
};

const styles = StyleSheet.create<CatalogueViewStyles>({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  canvas: {
    flex: 1,
    backgroundColor: Colors.dark.tabBarBackground,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  summaryCaption: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textOnAccent,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontWeight: Type.overline.weight,
  },
  binderPage: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceInverted,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    paddingLeft: Spacing.xxl,
  },
  ringColumn: {
    position: 'absolute',
    left: Spacing.xs,
    top: 0,
    bottom: 0,
    justifyContent: 'space-around',
    paddingVertical: Spacing.xxxl,
  },
  ring: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.border,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  pocket: {
    width: '32%',
    height: '100%',
    aspectRatio: 5 / 7,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  pocketEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.dark.pocketEmpty,
    backgroundColor: 'transparent',
  },
  pocketSkeleton: {
    backgroundColor: Colors.dark.pocketEmpty,
  },
  pageNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  pageOf: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    color: Colors.dark.textMuted,
    fontWeight: Type.subtitleItalic.weight,
  },
  filterPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  filterPillRowSingle: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  filterPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  filterPillLabel: {
    fontFamily: Type.body.font,
    fontSize: 12,
    color: Colors.dark.textOnAccent,
    fontWeight: Type.bodyStrong.weight,
  },
  filterPillIcon: {
    color: Colors.dark.textOnAccent,
  },
  filterOpenerPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.dark.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  filterOpenerLabel: {
    fontFamily: Type.body.font,
    fontSize: 12,
    color: Colors.dark.accentSoft,
    fontWeight: Type.bodyStrong.weight,
  },
  filterOpenerIcon: {
    color: Colors.dark.accentSoft,
  },
  pocketWrapper: {
    width: '32%',
    aspectRatio: 5 / 7,
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  pocketActionAdd: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pocketActionAddIcon: {
    color: Colors.dark.textOnAccent,
  },
  pocketOwnedGlyph: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  pocketOwnedGlyphLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: 11,
    color: Colors.dark.text,
    fontWeight: Type.bodyStrong.weight,
  },
  refreshHint: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.accentSoft,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshHintLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: 13,
    color: Colors.dark.accentSoft,
    fontWeight: Type.bodyStrong.weight,
    textAlign: 'center',
  },
});

const useStyles = (): CatalogueViewStyles => styles;

export default useStyles;
