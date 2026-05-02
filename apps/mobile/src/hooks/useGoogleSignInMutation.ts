import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';
import type { GoogleSignInResponse } from '@src/services/api/schemas';
import { writeSession } from '@src/services/auth/sessionStorage';
import { useSessionStore } from '@src/stores/sessionStore';

export type GoogleSignInVariables = {
  idToken: string;
};

const extractJwt = (response: GoogleSignInResponse): string | null => {
  if (response.session?.jwt) return response.session.jwt;
  if (response.token) return response.token;
  return null;
};

/**
 * TanStack `useMutation` wrapping `apiClient.signInWithGoogle`. On success, persists
 * the issued session to `expo-secure-store` and updates `sessionStore.status` to
 * `'active'`. The mutation never auto-retries (`retry: 0`) — sign-in is user-initiated.
 *
 * @returns the standard `UseMutationResult` for the sign-in flow
 * @throws (via `mutation.error`) `ApiError` with `kind: 'AUTH_INVALID_GOOGLE_TOKEN'` (401) | `'AUTH_NOT_ALLOWLISTED'` (403) | `'NETWORK_OFFLINE'` | `'SCHEMA_VALIDATION_ERROR'`
 *
 * @example
 *   const mutation = useGoogleSignInMutation();
 *   await mutation.mutateAsync({ idToken });
 */
export const useGoogleSignInMutation = (): UseMutationResult<
  GoogleSignInResponse,
  ApiError,
  GoogleSignInVariables
> =>
  useMutation<GoogleSignInResponse, ApiError, GoogleSignInVariables>({
    mutationFn: ({ idToken }) => apiClient.signInWithGoogle({ idToken }),
    retry: 0,
    onSuccess: async (response) => {
      const jwt = extractJwt(response);
      if (!jwt) {
        console.error('[useGoogleSignInMutation] response missing JWT', response);
        return;
      }
      const iat = Math.floor(Date.now() / 1000);
      try {
        await writeSession({ jwt, iat });
      } catch (cause) {
        console.error('[useGoogleSignInMutation] secure-store write failed', cause);
      }
      useSessionStore.getState().setSession({
        jwt,
        iat,
        userId: response.user.id,
        email: response.user.email,
      });
    },
  });