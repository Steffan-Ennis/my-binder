import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Spacing } from '@src/constants/theme';

export type BinderPageStyles = {
  // Measured wrapper (fills the page) that centres the fixed-width 3×3 block.
  grid: Required<Pick<ViewStyle, 'flex' | 'justifyContent' | 'alignItems'>>;
  // The 3-column block itself; width is supplied per-render from the measured fit.
  block: Required<Pick<ViewStyle, 'flexDirection' | 'flexWrap' | 'gap'>>;
};

const styles = StyleSheet.create<BinderPageStyles>({
  grid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  block: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Even gutters via `gap`; the pockets carry explicit, pre-fitted pixel sizes
    // (see BinderPage.tsx), so the 3×3 block needs no leftover-space distribution.
    gap: Spacing.xs,
  },
});

const useStyles = (): BinderPageStyles => styles;

export default useStyles;
