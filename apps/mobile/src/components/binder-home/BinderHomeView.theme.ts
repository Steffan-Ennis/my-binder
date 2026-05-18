import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';
const TRANSLUCENT_BUTTON_BG = 'rgba(0,0,0,0.32)';

export type BinderHomeViewStyles = {
  root: Required<Pick<ViewStyle, 'flex' | 'backgroundColor'>>;
  headerBar: Required<
    Pick<
      ViewStyle,
      | 'backgroundColor'
      | 'paddingHorizontal'
      | 'paddingTop'
      | 'paddingBottom'
      | 'flexDirection'
      | 'alignItems'
      | 'justifyContent'
    >
  >;
  mastheadGroup: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'flexShrink'>>;
  mastheadIcon: Required<Pick<TextStyle, 'marginRight'>>;
  mastheadText: Required<Pick<ViewStyle, 'flexShrink'>>;
  overline: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'color' | 'fontWeight'
    >
  >;
  title: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'fontStyle' | 'color' | 'fontWeight'
    >
  >;
  headerActions: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'gap'>>;
  iconButton: Required<
    Pick<
      ViewStyle,
      | 'width'
      | 'height'
      | 'borderRadius'
      | 'backgroundColor'
      | 'alignItems'
      | 'justifyContent'
    >
  >;
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
  pageNumber: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'fontStyle' | 'color' | 'fontWeight'
    >
  >;
  pageOf: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'color' | 'fontWeight'
    >
  >;
  searchInputRow: Required<
    Pick<ViewStyle, 'flex' | 'flexDirection' | 'alignItems' | 'gap'>
  >;
  searchInput: Required<
    Pick<
      TextStyle,
      'flex' | 'fontFamily' | 'fontSize' | 'color' | 'paddingHorizontal' | 'paddingVertical'
    >
  >;
  activeIndicator: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor'>
  >;
};

const styles = StyleSheet.create<BinderHomeViewStyles>({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerBar: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mastheadGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  mastheadIcon: {
    marginRight: Spacing.sm,
  },
  mastheadText: {
    flexShrink: 1,
  },
  overline: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.accent,
    fontWeight: Type.overline.weight,
  },
  title: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
    color: Colors.dark.text,
    fontWeight: Type.subtitleItalic.weight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconButton: {
    width: Touch.minTarget,
    height: Touch.minTarget,
    borderRadius: Radius.pill,
    backgroundColor: TRANSLUCENT_BUTTON_BG,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: Touch.minTarget,
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
  pageNumber: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
    color: Colors.dark.textOnAccent,
    fontWeight: Type.subtitleItalic.weight,
  },
  pageOf: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    lineHeight: Type.overline.lineHeight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textMuted,
    fontWeight: Type.overline.weight,
  },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    color: Colors.dark.text,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  activeIndicator: {
    width: Spacing.xs,
    height: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.accent,
  },
});

const useStyles = (): BinderHomeViewStyles => styles;

export default useStyles;
