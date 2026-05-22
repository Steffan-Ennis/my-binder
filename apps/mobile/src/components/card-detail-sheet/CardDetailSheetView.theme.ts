import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type CardDetailSheetViewStyles = {
  root: Required<Pick<ViewStyle, 'flex' | 'backgroundColor'>>;
  header: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingHorizontal' | 'paddingTop'>
  >;
  closeButton: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'alignItems' | 'justifyContent' | 'backgroundColor'>
  >;
  closeGlyph: Required<Pick<TextStyle, 'fontSize' | 'color' | 'lineHeight'>>;
  scroll: Required<Pick<ViewStyle, 'paddingHorizontal' | 'paddingBottom' | 'gap'>>;
  hero: Required<Pick<ViewStyle, 'flexDirection' | 'gap' | 'alignItems'>>;
  heroImage: Required<Pick<ImageStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor'>>;
  heroText: Required<Pick<ViewStyle, 'flex' | 'gap'>>;
  name: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'fontWeight'>>;
  setLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'letterSpacing' | 'color' | 'fontWeight'>>;
  typeLine: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'fontStyle'>>;
  oracle: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color'>>;
  stepperBlock: Required<Pick<ViewStyle, 'gap' | 'paddingTop'>>;
  sectionTitle: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'letterSpacing' | 'color' | 'fontWeight'>
  >;
  stepperRow: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'gap'>>;
  stepperButton: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'alignItems' | 'justifyContent' | 'backgroundColor'>
  >;
  stepperButtonDisabled: Required<Pick<ViewStyle, 'opacity'>>;
  stepperGlyph: Required<Pick<TextStyle, 'fontSize' | 'color' | 'lineHeight' | 'fontWeight'>>;
  stepperCount: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight' | 'minWidth' | 'textAlign'>>;
  section: Required<Pick<ViewStyle, 'gap' | 'paddingTop'>>;
  priceRow: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingVertical'>
  >;
  priceRowLabelGroup: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'gap'>>;
  priceSwatch: Required<Pick<ViewStyle, 'width' | 'height' | 'borderRadius'>>;
  priceLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  priceLabelDisabled: Required<Pick<TextStyle, 'color'>>;
  priceValue: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  priceValueDisabled: Required<Pick<TextStyle, 'color' | 'fontStyle'>>;
  skeleton: Required<Pick<ViewStyle, 'height' | 'borderRadius' | 'backgroundColor'>>;
  errorState: Required<Pick<ViewStyle, 'alignItems' | 'gap' | 'paddingVertical'>>;
  errorMessage: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'textAlign'>>;
  retryButton: Required<
    Pick<ViewStyle, 'minHeight' | 'paddingHorizontal' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'alignItems' | 'justifyContent'>
  >;
  retryLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
};

const HERO_IMAGE_W = 96;
const STEP_BTN = 44;

const styles = StyleSheet.create<CardDetailSheetViewStyles>({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceInverted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  closeButton: {
    width: Touch.minTarget,
    height: Touch.minTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  closeGlyph: {
    fontSize: 20,
    lineHeight: 24,
    color: Colors.dark.textInverted,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  heroImage: {
    width: HERO_IMAGE_W,
    height: HERO_IMAGE_W * 1.4,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.pocketEmpty,
  },
  heroText: {
    flex: 1,
    gap: Spacing.xxs,
  },
  name: {
    fontFamily: Type.headline.font,
    fontSize: Type.headline.size,
    lineHeight: Type.headline.lineHeight,
    color: Colors.dark.textInverted,
    fontWeight: Type.headline.weight,
  },
  setLabel: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textMuted,
    fontWeight: Type.overline.weight,
  },
  typeLine: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.textInverted,
    fontStyle: 'italic',
  },
  oracle: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.textInverted,
  },
  stepperBlock: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textMuted,
    fontWeight: Type.overline.weight,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepperButton: {
    width: STEP_BTN,
    height: STEP_BTN,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.accent,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperGlyph: {
    fontSize: 24,
    lineHeight: 28,
    color: Colors.dark.textOnAccent,
    fontWeight: '700',
  },
  stepperCount: {
    fontFamily: Type.headline.font,
    fontSize: Type.headline.size,
    color: Colors.dark.textInverted,
    fontWeight: Type.headline.weight,
    minWidth: 36,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  priceRowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  priceSwatch: {
    width: 12,
    height: 12,
    borderRadius: Radius.sm,
  },
  priceLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.textInverted,
    fontWeight: Type.bodyStrong.weight,
  },
  priceLabelDisabled: {
    color: Colors.dark.textMuted,
  },
  priceValue: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.textInverted,
    fontWeight: Type.bodyStrong.weight,
  },
  priceValueDisabled: {
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
  skeleton: {
    height: 18,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.pocketEmpty,
  },
  errorState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  errorMessage: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.error,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: Touch.minTarget,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.textInverted,
    fontWeight: Type.bodyStrong.weight,
  },
});

export type { CardDetailSheetViewStyles as Styles };

const useStyles = (): CardDetailSheetViewStyles => styles;

export default useStyles;
