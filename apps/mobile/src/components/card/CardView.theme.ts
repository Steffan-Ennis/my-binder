import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Touch, Type } from '@src/constants/theme';

// Canonical dashed-border tokens for the reusable `<Card />` slot. Both
// `BinderHomeView.theme.ts` (pocket footprint) and any future single-card
// screen (detail footprint) consume these via `useStyles()`. Lifted from
// `BinderHomeView.theme.ts`'s legacy `pocket` / `pocketEmpty` rules
// (research.md R7); the binder theme now passes through to keep tokens in
// one place.

export type CardViewStyles = {
  root: Required<Pick<ViewStyle, 'width' | 'height' | 'borderRadius' | 'overflow'>>;
  frame: Required<
    Pick<ViewStyle, 'flex' | 'borderWidth' | 'borderStyle' | 'borderColor' | 'backgroundColor' | 'alignItems' | 'justifyContent'>
  >;
  image: Required<Pick<ImageStyle, 'width' | 'height'>>;
  skeleton: Required<Pick<ViewStyle, 'width' | 'height' | 'backgroundColor'>>;
  fallbackCaption: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'color' | 'textAlign' | 'marginTop'>>;
  retryButton: Required<
    Pick<
      ViewStyle,
      'minHeight' | 'paddingHorizontal' | 'borderRadius' | 'backgroundColor' | 'alignItems' | 'justifyContent' | 'marginTop'
    >
  >;
  retryLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
};

const styles = StyleSheet.create<CardViewStyles>({
  // The card fills whatever sized box its consumer provides (a binder pocket or
  // the detail-sheet hero slot); the footprint itself is owned by the parent.
  root: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.dark.pocketEmpty,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  skeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.pocketEmpty,
  },
  fallbackCaption: {
    fontFamily: Type.body.font,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.dark.textOnAccent,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  retryButton: {
    minHeight: Touch.minTarget,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  retryLabel: {
    fontFamily: Type.bodyStrong.font,
    fontSize: Type.bodyStrong.size,
    color: Colors.dark.accent,
    fontWeight: Type.bodyStrong.weight,
  },
});

const useStyles = (): CardViewStyles => styles;

export default useStyles;
