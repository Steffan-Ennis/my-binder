import { Stack } from 'expo-router';
import type { FC } from 'react';

// Spec 022 — the Scan tab is promoted from a single ComingSoon stub to a Stack so
// it can host the same `card-detail` form sheet the Binder and Catalogue stacks
// do (FR-006). The tab `name="scan"` in `(tabs)/_layout.tsx` keeps resolving to
// this group, exactly as `binder/` and `catalogue/` already work — the only tabs-
// layout edit is opting the tab out of the default header so the camera
// viewfinder renders edge-to-edge.
const ScanLayout: FC = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name={'index'} />
    <Stack.Screen
      name={'card-detail'}
      options={{
        animation: 'slide_from_bottom',
        presentation: 'formSheet',
        sheetAllowedDetents: [0.9],
        sheetInitialDetentIndex: 'last',
        sheetCornerRadius: 24,
      }}
    />
  </Stack>
);

export default ScanLayout;
