import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { Colors, Radius } from '@src/constants/theme';

import type { ReticleTone } from './ScanReticle';

// FR-002 / SC-005 — geometry plus one entry per `ReticleTone`, each carrying only
// that tone's `borderColor` (a `Colors.dark` token). The view selects the tone
// entry with `styles[tone]`, so the colour stays a single-source palette token
// and `useStyles()` needs no argument (Style co-location rule #3).
export type ScanReticleStyles = {
  container: Required<Pick<ViewStyle, 'position' | 'top' | 'left' | 'right' | 'bottom'>>;
  bracket: Required<Pick<ViewStyle, 'position' | 'width' | 'height'>>;
  topLeft: Required<
    Pick<ViewStyle, 'top' | 'left' | 'borderTopWidth' | 'borderLeftWidth' | 'borderTopLeftRadius'>
  >;
  topRight: Required<
    Pick<ViewStyle, 'top' | 'right' | 'borderTopWidth' | 'borderRightWidth' | 'borderTopRightRadius'>
  >;
  bottomLeft: Required<
    Pick<
      ViewStyle,
      'bottom' | 'left' | 'borderBottomWidth' | 'borderLeftWidth' | 'borderBottomLeftRadius'
    >
  >;
  bottomRight: Required<
    Pick<
      ViewStyle,
      'bottom' | 'right' | 'borderBottomWidth' | 'borderRightWidth' | 'borderBottomRightRadius'
    >
  >;
} & Record<ReticleTone, Required<Pick<ViewStyle, 'borderColor'>>>;

const BRACKET_SIZE = 36;
const BRACKET_WIDTH = 3;

const styles = StyleSheet.create<ScanReticleStyles>({
  container: {
    position: 'absolute',
    top: '18%',
    left: '12%',
    right: '12%',
    bottom: '26%',
  },
  bracket: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: BRACKET_WIDTH,
    borderLeftWidth: BRACKET_WIDTH,
    borderTopLeftRadius: Radius.md,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: BRACKET_WIDTH,
    borderRightWidth: BRACKET_WIDTH,
    borderTopRightRadius: Radius.md,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: BRACKET_WIDTH,
    borderLeftWidth: BRACKET_WIDTH,
    borderBottomLeftRadius: Radius.md,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: BRACKET_WIDTH,
    borderRightWidth: BRACKET_WIDTH,
    borderBottomRightRadius: Radius.md,
  },
  // Tone → palette token. Reads as the binder's warm gold (never the
  // wireframe's white/blue); a palette change stays single-source.
  idle: { borderColor: Colors.dark.accent },
  aligned: { borderColor: Colors.dark.accentPressed },
  error: { borderColor: Colors.dark.error },
});

const useStyles = (): ScanReticleStyles => styles;

export default useStyles;
