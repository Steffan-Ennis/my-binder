// Spec 022 — styles for `CardScannerView`. Co-located per the Style co-location
// convention (`useStyles` default export, typed via `Required<Pick<…>>`). Every
// colour is a `Colors.dark` palette token — no raw hex (FR-002). The camera fills
// the screen; the mode toggle, status banner, match list, and control bar are
// absolutely positioned chrome over the live viewfinder.
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type CardScannerViewStyles = {
  root: Required<Pick<ViewStyle, 'flex' | 'backgroundColor'>>;
  camera: Required<Pick<ViewStyle, 'position' | 'top' | 'left' | 'right' | 'bottom'>>;

  modeToggle: Required<
    Pick<
      ViewStyle,
      'position' | 'top' | 'alignSelf' | 'flexDirection' | 'padding' | 'borderRadius' | 'backgroundColor' | 'gap'
    >
  >;
  modeSegment: Required<
    Pick<ViewStyle, 'paddingVertical' | 'paddingHorizontal' | 'borderRadius' | 'alignItems' | 'justifyContent'>
  >;
  modeSegmentActive: Required<Pick<ViewStyle, 'backgroundColor'>>;
  modeLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'color'>>;
  modeLabelActive: Required<Pick<TextStyle, 'color'>>;
  modeLabelDisabled: Required<Pick<TextStyle, 'color'>>;

  controlBar: Required<
    Pick<
      ViewStyle,
      'position' | 'left' | 'right' | 'bottom' | 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingHorizontal' | 'paddingVertical'
    >
  >;
  sideButton: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'alignItems' | 'justifyContent' | 'backgroundColor'>
  >;
  sideButtonActive: Required<Pick<ViewStyle, 'backgroundColor'>>;
  captureButton: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'backgroundColor' | 'alignItems' | 'justifyContent'>
  >;
  captureButtonDisabled: Required<Pick<ViewStyle, 'backgroundColor'>>;

  banner: Required<
    Pick<
      ViewStyle,
      'position' | 'left' | 'right' | 'bottom' | 'alignItems' | 'gap' | 'padding' | 'borderRadius' | 'backgroundColor'
    >
  >;
  bannerText: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'textAlign'>>;
  retryButton: Required<
    Pick<ViewStyle, 'minHeight' | 'paddingHorizontal' | 'borderRadius' | 'backgroundColor' | 'alignItems' | 'justifyContent'>
  >;
  retryLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'color'>>;

  matchListWrapper: Required<Pick<ViewStyle, 'position' | 'left' | 'right' | 'bottom'>>;
  matchList: Required<Pick<ViewStyle, 'maxHeight' | 'borderRadius' | 'backgroundColor'>>;
  matchListContent: Required<Pick<ViewStyle, 'padding' | 'gap'>>;
  matchRow: Required<Pick<ViewStyle, 'paddingVertical' | 'paddingHorizontal' | 'borderRadius' | 'minHeight' | 'justifyContent'>>;
  matchName: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'color'>>;
  matchMeta: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color'>>;

  centered: Required<Pick<ViewStyle, 'flex' | 'alignItems' | 'justifyContent' | 'gap' | 'paddingHorizontal'>>;
  messageTitle: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight' | 'color' | 'textAlign'>>;
  messageBody: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'textAlign'>>;
};

const CAPTURE_SIZE = 72;
const CAPTURE_BORDER = 4;
const BANNER_OFFSET = 132;
// Caps the results window so it can't cover the viewfinder; overflow scrolls.
const MATCH_LIST_MAX_HEIGHT = 280;

const styles = StyleSheet.create<CardScannerViewStyles>({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDeep,
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  modeToggle: {
    position: 'absolute',
    top: Spacing.giant,
    alignSelf: 'center',
    flexDirection: 'row',
    padding: Spacing.xxs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.backgroundElevated,
    gap: Spacing.xxs,
  },
  modeSegment: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentActive: {
    backgroundColor: Colors.dark.accent,
  },
  modeLabel: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    fontWeight: Type.bodyStrong.weight,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.text,
  },
  modeLabelActive: {
    color: Colors.dark.textOnAccent,
  },
  modeLabelDisabled: {
    color: Colors.dark.textMuted,
  },

  controlBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xl,
  },
  sideButton: {
    width: Touch.minTarget,
    height: Touch.minTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.backgroundElevated,
  },
  sideButtonActive: {
    backgroundColor: Colors.dark.accent,
  },
  captureButton: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: Radius.pill,
    borderWidth: CAPTURE_BORDER,
    borderColor: Colors.dark.surfaceInverted,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: Colors.dark.accentSoft,
  },

  banner: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: BANNER_OFFSET,
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.backgroundElevated,
  },
  bannerText: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: Touch.minTarget,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    fontWeight: Type.bodyStrong.weight,
    color: Colors.dark.textOnAccent,
  },

  matchListWrapper: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: BANNER_OFFSET,
  },
  matchList: {
    maxHeight: MATCH_LIST_MAX_HEIGHT,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.backgroundElevated,
  },
  matchListContent: {
    padding: Spacing.xs,
    gap: Spacing.xxs,
  },
  matchRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    minHeight: Touch.minTarget,
    justifyContent: 'center',
  },
  matchName: {
    fontFamily: Type.headline.font,
    fontSize: Type.headline.size,
    fontWeight: Type.headline.weight,
    color: Colors.dark.text,
  },
  matchMeta: {
    fontFamily: Type.caption.font,
    fontSize: Type.caption.size,
    color: Colors.dark.textMuted,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  messageTitle: {
    fontFamily: Type.headline.font,
    fontSize: Type.headline.size,
    lineHeight: Type.headline.lineHeight,
    fontWeight: Type.headline.weight,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  messageBody: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.textMuted,
    textAlign: 'center',
  },
});

const useStyles = (): CardScannerViewStyles => styles;

export default useStyles;
