import * as SecureStore from 'expo-secure-store';

const JWT_KEY = 'session.jwt';
const IAT_KEY = 'session.iat';

export type StoredSession = {
  jwt: string;
  iat: number;
};

/**
 * Read a previously persisted `{ jwt, iat }` pair from `expo-secure-store`.
 *
 * @returns the stored session, or `null` when no session has been written
 * @throws Error from the underlying secure-store driver (logged before re-throw per Principle VIII)
 *
 * @example
 *   const session = await readSession();
 *   if (!session) navigate('/login');
 */
export const readSession = async (): Promise<StoredSession | null> => {
  const [jwt, iatRaw] = await Promise.all([
    SecureStore.getItemAsync(JWT_KEY),
    SecureStore.getItemAsync(IAT_KEY),
  ]);

  if (!jwt || !iatRaw) return null;

  const iat = Number.parseInt(iatRaw, 10);
  if (!Number.isFinite(iat)) return null;

  return { jwt, iat };
};

/**
 * Persist a new session to `expo-secure-store`. Overwrites any prior session.
 *
 * @param input - non-empty `jwt` and integer `iat` (epoch seconds)
 * @returns void on success
 * @throws Error from the underlying secure-store driver
 *
 * @example
 *   await writeSession({ jwt: 'eyJ...', iat: Math.floor(Date.now() / 1000) });
 */
export const writeSession = async (input: StoredSession): Promise<void> => {
  await Promise.all([
    SecureStore.setItemAsync(JWT_KEY, input.jwt),
    SecureStore.setItemAsync(IAT_KEY, String(input.iat)),
  ]);
};

/**
 * Delete any persisted session keys. Safe to call when no session exists.
 *
 * @returns void
 *
 * @example
 *   await clearSession();
 */
export const clearSession = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(JWT_KEY),
    SecureStore.deleteItemAsync(IAT_KEY),
  ]);
};