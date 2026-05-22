import {FC} from 'react';
import { Stack } from 'expo-router';

import { CatalogueProvider } from '@src/context/catalogue-context';

const CatalogueLayout: FC = () => {
  return (
    <CatalogueProvider>
      <Stack
        screenOptions={{
          headerShown: false
        }}
      >
        <Stack.Screen name={'catalogue'} />
        <Stack.Screen
          name={'filter-modal'}
          options={{
            gestureEnabled: false,
            animation: 'slide_from_bottom',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9],
            sheetInitialDetentIndex: 'last',
            sheetCornerRadius: 24,
          }}
        />
        {/*<Stack.Screen*/}
        {/*  name={'card-detail'}*/}
        {/*  options={{*/}
        {/*    // Spec 020 — swipe-down dismiss stays ENABLED here (FR-005), unlike*/}
        {/*    // the filter sheet; that is the only deviation from its options.*/}
        {/*    animation: 'slide_from_bottom',*/}
        {/*    presentation: 'formSheet',*/}
        {/*    sheetAllowedDetents: [0.9],*/}
        {/*    sheetInitialDetentIndex: 'last',*/}
        {/*    sheetCornerRadius: 24,*/}
        {/*  }}*/}
        {/*/>*/}
      </Stack>
    </CatalogueProvider>
  )
}

export default CatalogueLayout
