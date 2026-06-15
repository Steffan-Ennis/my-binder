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
      'flex' | 'backgroundColor' | 'borderRadius' | 'paddingVertical' | 'paddingHorizontal'
    >
  >;
  ringColumn: Required<
    Pick<
      ViewStyle,
      'position' | 'left' | 'top' | 'bottom' | 'justifyContent' | 'paddingVertical'
    >
  >;
  ring: Required<Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor'>>;
  pageNavigator: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingTop'>
  >;
  pageOf: Required<
    Pick<
      TextStyle,
      'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'fontWeight'
    >
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
    // Symmetric horizontal padding keeps the centred 3×3 grid true; `xl` clears
    // the absolutely-positioned ring column (left: xs + ring width sm = 20pt).
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
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
});

const useStyles = (): BinderHomeViewStyles => styles;

export default useStyles;
