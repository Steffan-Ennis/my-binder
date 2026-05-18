import type { ImageStyle, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@src/constants/theme';

export type CardPocketStyles = {
  pocket: Required<
    Pick<
      ViewStyle,
      'width' | 'height' | 'aspectRatio' | 'borderRadius' | 'overflow' | 'marginBottom'
    >
  >;
  pocketEmpty: Required<
    Pick<ViewStyle, 'borderWidth' | 'borderStyle' | 'borderColor' | 'backgroundColor'>
  >;
  pocketImage: Required<Pick<ImageStyle, 'width' | 'height'>>;
};

const useStyles = (): CardPocketStyles => {

  return {
    pocket: {
      width: '32%',
      height: '100%',
      aspectRatio: 5 / 7,
      borderRadius: Radius.md,
      overflow: 'hidden',
      marginBottom: Spacing.xs,
    },
    pocketEmpty: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: Colors.dark.pocketEmpty,
      backgroundColor: 'transparent',
    },
    pocketImage: {
      width: '100%',
      height: '100%',
    },
  }

};

export default useStyles;
