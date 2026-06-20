// Spec 022 — the framing reticle (bounding box) the user aligns a card to.
// A real child component (not a `renderReticle()` function), shared with plan B.
// Pure chrome: no ML, no state, no effects. All colour comes from palette
// tokens via the theme — zero literal hex (FR-002 / SC-005).
import type { FC } from 'react';
import { View } from 'react-native';

import useStyles from './ScanReticle.theme';

/** Bracket colour intent → palette token (mapped in `ScanReticle.theme.ts`). */
export type ReticleTone = 'idle' | 'aligned' | 'error';

export type ScanReticleProps = { tone: ReticleTone };

const CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

const ScanReticle: FC<ScanReticleProps> = ({ tone }) => {
  const styles = useStyles();

  return (
    <View style={styles.container} pointerEvents="none" testID="scan-reticle">
      {CORNERS.map((corner) => (
        <View
          key={corner}
          testID={`scan-reticle-${corner}`}
          style={[styles.bracket, styles[corner], styles[tone]]}
        />
      ))}
    </View>
  );
};

export default ScanReticle;
