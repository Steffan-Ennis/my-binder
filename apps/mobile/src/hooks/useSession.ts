import { SESSION_JWT_TTL_DAYS } from '@my-binder/core';
import { useEffect, useMemo } from 'react';

import { readSession } from '@src/services/auth/sessionStorage';
import { useSessionStore, type SessionStatus } from '@src/stores/sessionStore';

const SECONDS_PER_DAY = 86_400;

export type UseSessionResult = {
  status: SessionStatus;
  userId: string | null;
  email: string | null;
  jwt: string | null;
};

const decodeJwtClaims = (jwt: string): { sub?: string; email?: string } => {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return {};
    const payload = parts[1];
    const json = globalThis.atob
      ? globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      : Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json) as { sub?: string; email?: string };
  } catch {
    return {};
  }
};

const isExpired = (iat: number, nowSec: number): boolean =>
  nowSec >= iat + SESSION_JWT_TTL_DAYS * SECONDS_PER_DAY;

/**
 * Read-only view of the current session, hydrated once on mount from
 * `expo-secure-store`. Returned references are reference-stable per the
 * v1.16.0 memoisation rule.
 *
 * @returns `{ status, userId, email, jwt }` — populated when status is `'active'`
 *
 * @example
 *   const { status } = useSession();
 *   if (status !== 'active') return <Redirect href="/login" />;
 */
export const useSession = (): UseSessionResult => {
  const status = useSessionStore((s) => s.status);
  const userId = useSessionStore((s) => s.userId);
  const email = useSessionStore((s) => s.email);
  const jwt = useSessionStore((s) => s.jwt);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readSession();
      if (cancelled || !stored) return;
      const nowSec = Math.floor(Date.now() / 1000);
      if (isExpired(stored.iat, nowSec)) {
        useSessionStore.getState().markExpired();
        return;
      }
      const claims = decodeJwtClaims(stored.jwt);
      useSessionStore.getState().setSession({
        jwt: stored.jwt,
        iat: stored.iat,
        userId: claims.sub ?? '',
        email: claims.email ?? '',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({ status, userId, email, jwt }),
    [status, userId, email, jwt],
  );
};