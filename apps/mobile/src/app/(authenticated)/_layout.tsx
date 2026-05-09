import { Redirect, Stack } from 'expo-router';
import type { FC } from 'react';

import { useSession } from '@src/hooks/useSession';

const AuthenticatedLayout: FC = () => {
  const { status } = useSession();
  if (status !== 'active') return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
};

export default AuthenticatedLayout;