import { renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useSessionStore } from '@src/stores/sessionStore';

import { useSession } from './useSession';

const mockedGet = SecureStore.getItemAsync as jest.Mock;

const reset = () => {
  mockedGet.mockReset();
  useSessionStore.setState({
    jwt: null,
    iat: null,
    userId: null,
    email: null,
    status: 'idle',
  });
};

const makeJwt = (claims: Record<string, unknown>): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
};

describe('useSession', () => {
  beforeEach(reset);

  it('hydrates an active session within the 7-day window', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = makeJwt({ sub: 'u1', email: 'u1@example.com' });
    mockedGet.mockImplementation((key: string) =>
      Promise.resolve(key === 'session.jwt' ? jwt : String(nowSec - 60)),
    );

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.userId).toBe('u1');
    expect(result.current.email).toBe('u1@example.com');
    expect(result.current.jwt).toBe(jwt);
  });

  it('marks the session expired when iat + 7 days has elapsed', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredIat = nowSec - 8 * 86_400;
    mockedGet.mockImplementation((key: string) =>
      Promise.resolve(key === 'session.jwt' ? makeJwt({ sub: 'u' }) : String(expiredIat)),
    );

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('expired'));
  });

  it('stays idle when secure-store has no stored session', async () => {
    mockedGet.mockResolvedValue(null);
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(result.current.status).toBe('idle');
  });

  it('returns a reference-stable result when state has not changed', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockedGet.mockImplementation((key: string) =>
      Promise.resolve(key === 'session.jwt' ? makeJwt({ sub: 'u' }) : String(nowSec)),
    );

    const { result, rerender } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('active'));
    const first = result.current;
    rerender(undefined);
    expect(result.current).toBe(first);
  });
});