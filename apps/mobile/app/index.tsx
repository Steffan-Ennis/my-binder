import { Redirect } from 'expo-router';
import type { FC } from 'react';

import { useSession } from '@src/hooks/useSession';

const Index: FC = () => {
  const { status } = useSession();
  return status === 'active' ? <Redirect href="/binder" /> : <Redirect href="/login" />;
};

export default Index;