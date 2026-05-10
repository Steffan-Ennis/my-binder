import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';
import { revokeGoogleGrant } from '@src/services/auth/googleAuth';
import { clearSession as clearStoredSession } from '@src/services/auth/sessionStorage';
import { useSessionStore } from '@src/stores/sessionStore';

export type SignOutVariables = {
  googleAccessToken: string | null;
};

/**
 * TanStack `useMutation` for the sign-out flow. The cleanup chain (clear secure-store,
 * revoke Google grant, reset Zustand stores, `queryClient.clear()`, navigate to Login)
 * runs even if the server `POST /auth/signout` rejects, so the user-intent "sign me out"
 * is always honoured locally (per `contracts/api-client.md`).
 *
 * @returns the standard `UseMutationResult` — the resolved value is `void` on completion
 *
 * @example
 *   const mutation = useSignOutMutation();
 *   await mutation.mutateAsync({ googleAccessToken: lastGoogleAccessToken });
 */
export const useSignOutMutation = (): UseMutationResult<
  void,
  ApiError,
  SignOutVariables
> => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<void, ApiError, SignOutVariables>({
    retry: 0,
    mutationFn: async ({ googleAccessToken }) => {
      try {
        await apiClient.signOut();
      } catch (cause) {
        console.error('[useSignOutMutation] server signout failed (continuing cleanup)', cause);
      }

      try {
        await clearStoredSession();
      } catch (cause) {
        console.error('[useSignOutMutation] secure-store clear failed', cause);
      }

      if (googleAccessToken) {
        try {
          await revokeGoogleGrant(googleAccessToken);
        } catch (cause) {
          console.error('[useSignOutMutation] google revoke failed', cause);
        }
      }

      useSessionStore.getState().clearSession();
      queryClient.clear();
      router.replace('/login');
    },
  });
};
