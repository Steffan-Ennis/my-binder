import { Redirect } from 'expo-router';
import type { FC } from 'react';

const OauthRedirect: FC = () => {
  return <Redirect href="/login" />;
};

export default OauthRedirect;
