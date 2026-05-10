import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type LoginViewStyles = {
  root: Required<
    Pick<
      ViewStyle,
      | 'flex'
      | 'backgroundColor'
      | 'paddingHorizontal'
      | 'paddingTop'
      | 'paddingBottom'
      | 'justifyContent'
    >
  >;
  mast: Required<Pick<ViewStyle, 'alignItems' | 'gap'>>;
  glyph: Required<Pick<ViewStyle, 'marginTop' | 'marginLeft'>>;
  title: Required<
    Pick<
      TextStyle,
      | 'color'
      | 'fontFamily'
      | 'fontSize'
      | 'lineHeight'
      | 'fontWeight'
      | 'fontStyle'
      | 'textAlign'
    >
  >;
  subtitle: Required<
    Pick<TextStyle, 'color' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontStyle'>
  >;
  buttonContainer: Required<Pick<ViewStyle, 'gap'>>;
  error: Required<
    Pick<TextStyle, 'color' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'textAlign'>
  >;
  button: Required<
    Pick<
      ViewStyle,
      | 'backgroundColor'
      | 'height'
      | 'borderRadius'
      | 'alignItems'
      | 'justifyContent'
      | 'paddingHorizontal'
    >
  >;
  buttonPressed: Required<Pick<ViewStyle, 'opacity'>>;
  buttonDisabled: Required<Pick<ViewStyle, 'opacity'>>;
  buttonLabel: Required<
    Pick<TextStyle, 'color' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight'>
  >;
};

const styles = StyleSheet.create<LoginViewStyles>({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.giant,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  mast: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  glyph: {
    marginTop: Spacing.lg,
    marginLeft: Spacing.sm,
  },
  title: {
    color: Colors.dark.accent,
    fontFamily: Type.display.font,
    fontSize: Type.display.size,
    lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.dark.text,
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  error: {
    color: Colors.dark.error,
    fontFamily: Type.caption.font,
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.light.background,
    height: Touch.buttonHeight,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    color: Colors.light.text,
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    lineHeight: Type.bodyStrong.lineHeight,
    fontWeight: Type.bodyStrong.weight,
  },
});

const useStyles = (): LoginViewStyles => styles;

export default useStyles;
