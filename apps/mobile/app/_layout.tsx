import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, type FC } from 'react';
import { StatusBar } from 'expo-status-bar';

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
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
};

export default RootLayout;
