import { useCallback, useMemo, useRef } from 'react';

import { useSignOutMutation } from '@src/hooks/useSignOutMutation';

const CONTACT_HREF = 'mailto:hello@my-binder.app';

export type UseAccessDeniedResult = {
  contactHref: string;
  onTryDifferentAccount: () => Promise<void>;
};

/**
 * Powers the AccessDenied screen — exposes a stable contact href and a
 * "try a different account" handler that signs the user out of the current
 * Google session and routes back to Login (per FR-005).
 *
 * @returns `{ contactHref, onTryDifferentAccount }` with reference-stable values
 *
 * @example
 *   const { contactHref, onTryDifferentAccount } = useAccessDenied();
 */
export const useAccessDenied = (): UseAccessDeniedResult => {
  const signOut = useSignOutMutation();
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  const onTryDifferentAccount = useCallback(async () => {
    try {
      await signOutRef.current.mutateAsync({ googleAccessToken: null });
    } catch (cause) {
      console.error('[useAccessDenied] signOut failed', cause);
    }
  }, []);

  return useMemo(
    () => ({ contactHref: CONTACT_HREF, onTryDifferentAccount }),
    [onTryDifferentAccount],
  );
};