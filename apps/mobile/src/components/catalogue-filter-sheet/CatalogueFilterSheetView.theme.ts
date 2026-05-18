import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

export type CatalogueFilterSheetViewStyles = {
  container: Required<Pick<ViewStyle, 'flex' | 'paddingHorizontal' | 'paddingBottom'>>;
  header: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingVertical'>
  >;
  headerTitle: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontStyle' | 'color' | 'fontWeight'>
  >;
  closeButton: Required<
    Pick<
      ViewStyle,
      'width' | 'height' | 'borderRadius' | 'alignItems' | 'justifyContent' | 'backgroundColor'
    >
  >;
  toggleRow: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'paddingVertical'>
  >;
  toggleLabelGroup: Required<Pick<ViewStyle, 'flexShrink'>>;
  toggleLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  toggleHelper: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color'>>;
  section: Required<Pick<ViewStyle, 'paddingTop' | 'paddingBottom'>>;
  sectionLabel: Required<
    Pick<TextStyle, 'fontFamily' | 'fontSize' | 'letterSpacing' | 'color' | 'fontWeight' | 'marginBottom'>
  >;
  chipRow: Required<Pick<ViewStyle, 'flexDirection' | 'flexWrap' | 'gap'>>;
  chip: Required<
    Pick<
      ViewStyle,
      'paddingHorizontal' | 'paddingVertical' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'backgroundColor'
    >
  >;
  chipSelected: Required<Pick<ViewStyle, 'backgroundColor' | 'borderColor'>>;
  chipLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  chipLabelSelected: Required<Pick<TextStyle, 'color'>>;
  colorChip: Required<
    Pick<
      ViewStyle,
      'width' | 'height' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'alignItems' | 'justifyContent'
    >
  >;
  colorChipSelected: Required<Pick<ViewStyle, 'borderColor' | 'borderWidth'>>;
  colorChipLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  cmcRow: Required<Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'gap'>>;
  cmcInput: Required<
    Pick<
      TextStyle,
      'borderWidth' | 'borderColor' | 'borderRadius' | 'paddingHorizontal' | 'paddingVertical' | 'minWidth' | 'color' | 'fontFamily' | 'fontSize'
    >
  >;
  cmcSeparator: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color'>>;
  footer: Required<
    Pick<ViewStyle, 'flexDirection' | 'alignItems' | 'justifyContent' | 'gap' | 'paddingTop'>
  >;
  ghostButton: Required<
    Pick<
      ViewStyle,
      'minHeight' | 'paddingHorizontal' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'alignItems' | 'justifyContent'
    >
  >;
  ghostButtonLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  primaryButton: Required<
    Pick<
      ViewStyle,
      'minHeight' | 'paddingHorizontal' | 'borderRadius' | 'backgroundColor' | 'alignItems' | 'justifyContent'
    >
  >;
  primaryButtonLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  // iOS-style toggle (two states + thumb).
  toggleTrack: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor' | 'justifyContent' | 'padding'>
  >;
  toggleTrackOn: Required<Pick<ViewStyle, 'backgroundColor'>>;
  toggleThumb: Required<
    Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'backgroundColor' | 'alignSelf'>
  >;
  toggleThumbOn: Required<Pick<ViewStyle, 'alignSelf'>>;
};

const CHIP_HEIGHT = 32;
const COLOR_CHIP_SIZE = 36;
const TOGGLE_TRACK_W = 52;
const TOGGLE_TRACK_H = 30;
const TOGGLE_THUMB = 24;

const styles = StyleSheet.create<CatalogueFilterSheetViewStyles>({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: Type.subtitleItalic.font,
    fontSize: Type.subtitleItalic.size,
    lineHeight: Type.subtitleItalic.lineHeight,
    fontStyle: 'italic',
    color: Colors.dark.textOnAccent,
    fontWeight: Type.subtitleItalic.weight,
  },
  closeButton: {
    width: Touch.minTarget,
    height: Touch.minTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  toggleLabelGroup: {
    flexShrink: 1,
  },
  toggleLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.textOnAccent,
    fontWeight: Type.bodyStrong.weight,
  },
  toggleHelper: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    color: Colors.dark.textMuted,
  },
  section: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Type.overline.font,
    fontSize: Type.overline.size,
    letterSpacing: Type.overline.letterSpacing,
    color: Colors.dark.textMuted,
    fontWeight: Type.overline.weight,
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: (CHIP_HEIGHT - 18) / 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  chipLabel: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    color: Colors.dark.text,
    fontWeight: Type.body.weight,
  },
  chipLabelSelected: {
    color: Colors.dark.textOnAccent,
  },
  colorChip: {
    width: COLOR_CHIP_SIZE,
    height: COLOR_CHIP_SIZE,
    borderRadius: COLOR_CHIP_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipSelected: {
    borderColor: Colors.dark.accentSoft,
    borderWidth: 3,
  },
  colorChipLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.text,
    fontWeight: Type.bodyStrong.weight,
  },
  cmcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cmcInput: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 64,
    color: Colors.dark.text,
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
  },
  cmcSeparator: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    color: Colors.dark.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  ghostButton: {
    minHeight: Touch.buttonHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.text,
    fontWeight: Type.bodyStrong.weight,
  },
  primaryButton: {
    minHeight: Touch.buttonHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.textOnAccent,
    fontWeight: Type.bodyStrong.weight,
  },
  toggleTrack: {
    width: TOGGLE_TRACK_W,
    height: TOGGLE_TRACK_H,
    borderRadius: TOGGLE_TRACK_H / 2,
    backgroundColor: Colors.dark.border,
    justifyContent: 'center',
    padding: (TOGGLE_TRACK_H - TOGGLE_THUMB) / 2,
  },
  toggleTrackOn: {
    backgroundColor: Colors.dark.accent,
  },
  toggleThumb: {
    width: TOGGLE_THUMB,
    height: TOGGLE_THUMB,
    borderRadius: TOGGLE_THUMB / 2,
    backgroundColor: Colors.dark.textOnAccent,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
});

export type { CatalogueFilterSheetViewStyles as Styles };

const useStyles = (): CatalogueFilterSheetViewStyles => styles;

export default useStyles;
