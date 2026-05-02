import type { FC } from 'react';

import { LoginView } from './LoginView';
import { useLogin } from './useLogin';

const LoginContainer: FC = () => {
  const { isSigningIn, errorMessage, onSignInPress } = useLogin();
  return (
    <LoginView
      isSigningIn={isSigningIn}
      errorMessage={errorMessage}
      onSignInPress={onSignInPress}
    />
  );
};

export default LoginContainer;
export { LoginContainer };