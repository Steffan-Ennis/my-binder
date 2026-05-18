import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@src/constants/theme';

export type BinderHomeViewStyles = {
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
    Pick<
      ViewStyle,
      'flex' | 'backgroundColor' | 'borderRadius' | 'padding' | 'paddingLeft'
    >
  >;
  ringColumn: Required<
    Pick<
      ViewStyle,
      'position' | 'left' | 'top' | 'bottom' | 'justifyContent' | 'paddingVertical'
    >
  >;
  ring: Required<Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor'>>;
  errorState: Required<Pick<ViewStyle, 'flex' | 'alignItems' | 'justifyContent' | 'gap'>>;
  errorMessage: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'textAlign'>
  >;
  retryButton: Required<
    Pick<
      ViewStyle,
      | 'minHeight'
      | 'paddingHorizontal'
      | 'borderRadius'
      | 'backgroundColor'
      | 'alignItems'
      | 'justifyContent'
    >
  >;
  retryLabel: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>
  >;
  pageNavigator: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingTop'>
  >;
  pager: Required<Pick<ViewStyle, 'flex'>>;
  pageOf: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'color' | 'fontWeight'
    >
  >;
  // US4 — populated-pocket grid + glyph overlays.
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
  pocketWrapper: Required<
    Pick<ViewStyle, 'width' | 'aspectRatio' | 'marginBottom' | 'position'>
  >;
  pocketActionRemove: Required<
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
  pocketActionRemoveIcon: Required<Pick<TextStyle, 'color'>>;
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
};

const styles = StyleSheet.create<BinderHomeViewStyles>({
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
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorMessage: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.textOnAccent,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.accent,
    fontWeight: Type.bodyStrong.weight,
  },
  pageNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  pager: {
    flex: 1,
  },
  pageOf: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textMuted,
    fontWeight: Type.overline.weight,
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
  pocketWrapper: {
    width: '32%',
    aspectRatio: 5 / 7,
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  pocketActionRemove: {
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
  pocketActionRemoveIcon: {
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
});

const useStyles = (): BinderHomeViewStyles => styles;

export default useStyles;
