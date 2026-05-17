import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

const TRANSLUCENT_BUTTON_BG = 'rgba(0,0,0,0.32)';

export type MastheadStyles = {
  root: Required<Pick<ViewStyle, 'backgroundColor'>>;
  headerBar: Required<
    Pick<
      ViewStyle,
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
  subtitle: Required<
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
  filterPillSlot: Required<
    Pick<ViewStyle, 'paddingHorizontal' | 'paddingBottom'>
  >;
};

const styles = StyleSheet.create<MastheadStyles>({
  root: {
    backgroundColor: Colors.dark.background,
  },
  headerBar: {
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
  subtitle: {
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
  filterPillSlot: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});

const useStyles = (): MastheadStyles => styles;

export default useStyles;
