import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, type FC } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient, registerAuthErrorHandler } from '@src/services/api/queryClient';

const RootLayout: FC = () => {
  const router = useRouter();
  useEffect(() => {
    registerAuthErrorHandler((kind) => {
      if (kind === 'access_denied') router.replace('/access-denied');
      else router.replace('/login');
    });
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
};

export default RootLayout;
