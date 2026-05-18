import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

export type BinderPageStyles = {
  grid: Required<
    Pick<
      ViewStyle,
      'flex' | 'flexDirection' | 'flexWrap' | 'justifyContent' | 'alignContent'
    >
  >;
};

const styles = StyleSheet.create<BinderPageStyles>({
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
});

const useStyles = (): BinderPageStyles => styles;

export default useStyles;
