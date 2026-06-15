// Styles for `BinderBody` — the binder-page body states (error / no-matches /
// loading / pager). Co-located per the Style co-location convention; these were
// extracted out of `BinderHomeView.theme.ts` when the body became its own
// component so each view owns only the styles it renders.
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@src/constants/theme';

export type BinderBodyStyles = {
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
  retryLabel: Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'>>;
  pager: Required<Pick<ViewStyle, 'flex'>>;
};

const styles = StyleSheet.create<BinderBodyStyles>({
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
  pager: {
    flex: 1,
  },
});

const useStyles = (): BinderBodyStyles => styles;

export default useStyles;
