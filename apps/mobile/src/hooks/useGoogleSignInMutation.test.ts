import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { ApiError } from '@src/services/api/ApiError';
import { useSessionStore } from '@src/stores/sessionStore';

import { useGoogleSignInMutation } from './useGoogleSignInMutation';

const mockedSet = SecureStore.setItemAsync as jest.Mock;
const mockedDelete = SecureStore.deleteItemAsync as jest.Mock;

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  mockedSet.mockReset();
  mockedDelete.mockReset();
  mockedSet.mockResolvedValue(undefined);
  useSessionStore.setState({
    jwt: null,
    iat: null,
    userId: null,
    email: null,
    status: 'idle',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } });
  jest.spyOn(apiModule.apiClient, 'signInWithGoogle').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useGoogleSignInMutation', () => {
  it('persists the session via expo-secure-store and updates sessionStore on success', async () => {
    jest.spyOn(apiModule.apiClient, 'signInWithGoogle').mockResolvedValue({
      user: { id: 'u1', email: 'u1@example.com', displayName: 'User One' },
      token: 'server.jwt.value',
    });

    const { result } = renderHook(() => useGoogleSignInMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ idToken: 'gid' });
    });

    await waitFor(() => expect(useSessionStore.getState().status).toBe('active'));
    expect(useSessionStore.getState().jwt).toBe('server.jwt.value');
    expect(useSessionStore.getState().userId).toBe('u1');
    expect(useSessionStore.getState().email).toBe('u1@example.com');
    expect(mockedSet).toHaveBeenCalledWith('session.jwt', 'server.jwt.value');
    expect(mockedSet).toHaveBeenCalledWith('session.iat', expect.any(String));
  });

  it('surfaces a retryable error on AUTH_INVALID_GOOGLE_TOKEN (401)', async () => {
    jest.spyOn(apiModule.apiClient, 'signInWithGoogle').mockRejectedValue(
      new ApiError({ message: 'bad', status: 401, kind: 'AUTH_INVALID_GOOGLE_TOKEN' }),
    );

    const { result } = renderHook(() => useGoogleSignInMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ idToken: 'gid' }).catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError | null)?.kind).toBe('AUTH_INVALID_GOOGLE_TOKEN');
    expect(useSessionStore.getState().status).toBe('idle');
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it('surfaces AUTH_NOT_ALLOWLISTED (403) without persisting a session', async () => {
    jest.spyOn(apiModule.apiClient, 'signInWithGoogle').mockRejectedValue(
      new ApiError({ message: 'no', status: 403, kind: 'AUTH_NOT_ALLOWLISTED' }),
    );

    const { result } = renderHook(() => useGoogleSignInMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ idToken: 'gid' }).catch(() => {});
    });

    await waitFor(() =>
      expect((result.current.error as ApiError | null)?.kind).toBe('AUTH_NOT_ALLOWLISTED'),
    );
    expect(useSessionStore.getState().status).toBe('idle');
    expect(mockedSet).not.toHaveBeenCalled();
  });
});