import type { ViewStyle } from 'react-native';
import { Colors, Radius } from '@src/constants/theme';

// The pocket footprint (width/height) is computed per-page from the measured grid
// box and passed in as a `size` prop — see `BinderPage.tsx` / `computeSlotSize`.
// These tokens carry only the pocket's visual treatment.
export type CardPocketStyles = {
  pocket: Required<Pick<ViewStyle, 'borderRadius' | 'overflow'>>;
  pocketEmpty: Required<
    Pick<ViewStyle, 'borderWidth' | 'borderStyle' | 'borderColor' | 'backgroundColor'>
  >;
};

const useStyles = (): CardPocketStyles => {

  return {
    pocket: {
      borderRadius: Radius.md,
      overflow: 'hidden',
    },
    pocketEmpty: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.dark.pocketEmpty,
      backgroundColor: 'transparent',
    },
  }
};

export default useStyles;
