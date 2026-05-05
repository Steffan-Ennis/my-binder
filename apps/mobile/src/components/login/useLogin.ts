import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGoogleSignInMutation } from '@src/hooks/useGoogleSignInMutation';
import { ApiError } from '@src/services/api/ApiError';
import { useGoogleAuthRequest } from '@src/services/auth/googleAuth';
import { useSessionStore } from '@src/stores/sessionStore';

export type UseLoginResult = {
  isSigningIn: boolean;
  errorMessage: string | null;
  onSignInPress: () => Promise<void>;
};

const friendlyErrorFor = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.kind === 'AUTH_INVALID_GOOGLE_TOKEN') return "Couldn't verify your Google account. Try again.";
    if (error.kind === 'NETWORK_OFFLINE') return 'No internet connection. Try again when you reconnect.';
    if (error.kind === 'AUTH_NOT_ALLOWLISTED') return '';
  }
  return "Something went wrong signing you in. Try again.";
};

/**
 * Compose the Google OAuth flow, the sign-in mutation, the session store, and the
 * router into a view-prop-shaped result. Stable references per the v1.16.0 rule.
 *
 * @returns `{ isSigningIn, errorMessage, onSignInPress }`
 *
 * @example
 *   const { isSigningIn, errorMessage, onSignInPress } = useLogin();
 *   return <LoginView isSigningIn={isSigningIn} errorMessage={errorMessage} onSignInPress={onSignInPress} />;
 */
export const useLogin = (): UseLoginResult => {
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const signIntoGoogle = useGoogleAuthRequest();
  const signInMutation = useGoogleSignInMutation();
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const handledResponseRef = useRef<unknown>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (status === 'active' && !navigatedRef.current) {
      navigatedRef.current = true;
      router.replace('/binder');
    }
  }, [status, router]);

  const onSignInPress = useCallback(async () => {
    setCancelMessage(null);
    handledResponseRef.current = null;
    const googAuthRequest = await signIntoGoogle()

    if (googAuthRequest.type === 'cancelled' ) {
      setCancelMessage('Sign-in was cancelled. Tap to try again.');
      return;
    }

    // if (googAuthRequest.type !== 'success' || !googAuthRequest.params?.id_token) return;

    setCancelMessage(null);
    signInMutation.mutate(
      { idToken: googAuthRequest.data.idToken as string },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.kind === 'AUTH_NOT_ALLOWLISTED') {
            router.replace('/access-denied');
          }
        },
        onSuccess(data) {
          useSessionStore.setState({
            status: 'active',
            email: data.user.email,
            jwt: data.session?.jwt,
            // @ts-expect-error
            iat: data.session?.expiresAt
          })
        }
      },
    );

  }, [signIntoGoogle, setCancelMessage, signInMutation, router]);

  const errorMessage = useMemo<string | null>(() => {
    if (cancelMessage) return cancelMessage;
    if (signInMutation.isError && signInMutation.error) {
      const friendly = friendlyErrorFor(signInMutation.error);
      return friendly === '' ? null : friendly;
    }
    return null;
  }, [cancelMessage, signInMutation.isError, signInMutation.error]);

  const isSigningIn = signInMutation.isPending;

  return useMemo(
    () => ({ isSigningIn, errorMessage, onSignInPress }),
    [isSigningIn, errorMessage, onSignInPress],
  );
};
