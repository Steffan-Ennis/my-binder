import { Stack } from 'expo-router';
import type { FC } from 'react';

// Spec 020 — the Binder tab is promoted from a single screen to a Stack so it
// can host the same `card-detail` form sheet the Catalogue does (FR-001). The
// tab `name="binder"` in `(tabs)/_layout.tsx` keeps resolving to this group,
// exactly as `catalogue/` already works — no tabs-layout edit needed.
const BinderLayout: FC = () => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name={'binder'} />
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

export default BinderLayout;
