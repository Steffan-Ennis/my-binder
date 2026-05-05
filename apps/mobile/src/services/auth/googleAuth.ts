import { revokeAsync } from 'expo-auth-session';
import { GoogleSignin, ConfigureParams } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import {useCallback} from "react";

const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export class UserCancelledError extends Error {
  readonly name = 'UserCancelledError';
  constructor(message = 'User cancelled the Google sign-in flow') {
    super(message);
  }
}

type ExtraConfig = {
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
};

const getExtra = (): ExtraConfig => {
  const extra = Constants.expoConfig?.extra;
  return (extra ?? {}) as ExtraConfig;
};

GoogleSignin.configure({
  iosClientId: getExtra().googleIosClientId,
  webClientId: getExtra().googleWebClientId
})

/**
 * Construct the Google OAuth request hook for use within `useLogin`.
 *
 * @returns the `[request, response, promptAsync]` tuple from `expo-auth-session/providers/google`
 *
 * @example
 *   const [request, response, promptAsync] = useGoogleAuthRequest();
 *   if (request) await promptAsync();
 */
export const useGoogleAuthRequest = () => {
  const extra = getExtra();

  const signIn = useCallback(async () => {
    return await GoogleSignin.signIn()
  }, [])

  return signIn
};

/**
 * Revoke a Google access token via the public revocation endpoint. Best-effort;
 * the caller is expected to clear local session state regardless of the result.
 *
 * @param token - the Google access (or refresh) token to revoke
 * @returns void on completion (success or failure are both swallowed by the caller)
 * @throws Error when the network request itself rejects (caller logs and ignores per Principle VIII)
 *
 * @example
 *   await revokeGoogleGrant(accessToken).catch((e) => log.warn('revoke failed', e));
 */
export const revokeGoogleGrant = async (token: string): Promise<void> => {
  if (!token) return;
  await revokeAsync({ token }, { revocationEndpoint: GOOGLE_REVOKE_ENDPOINT });
};
