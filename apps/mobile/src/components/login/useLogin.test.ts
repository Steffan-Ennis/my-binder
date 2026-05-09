import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { ApiError } from '@src/services/api/ApiError';
import { useSessionStore } from '@src/stores/sessionStore';

import { useLogin } from './useLogin';

const mockedUseAuthRequest = Google.useAuthRequest as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;
const mockedSet = SecureStore.setItemAsync as jest.Mock;

let client: QueryClient;
const replaceSpy = jest.fn();
const promptAsync = jest.fn();

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const ok = { user: { id: 'u1', email: 'u1@example.com' }, token: 'jwt.value' };

const setAuthResponse = (response: unknown) => {
  mockedUseAuthRequest.mockReturnValue([{ url: 'x' }, response, promptAsync]);
};

beforeEach(() => {
  mockedSet.mockReset();
  mockedSet.mockResolvedValue(undefined);
  mockedUseRouter.mockReturnValue({ push: jest.fn(), replace: replaceSpy, back: jest.fn() });
  replaceSpy.mockReset();
  promptAsync.mockReset();
  setAuthResponse(null);
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

describe('useLogin', () => {
  it('exposes a stable onSignInPress that calls promptAsync', async () => {
    const { result, rerender } = renderHook(() => useLogin(), { wrapper });
    const first = result.current.onSignInPress;
    rerender(undefined);
    expect(result.current.onSignInPress).toBe(first);

    await act(async () => {
      await result.current.onSignInPress();
    });
    expect(promptAsync).toHaveBeenCalled();
  });

  it('navigates to /binder after a successful sign-in', async () => {
    jest.spyOn(apiModule.apiClient, 'signInWithGoogle').mockResolvedValue(ok);
    setAuthResponse({
      type: 'success',
      params: { id_token: 'gid', access_token: 'gat' },
      authentication: { accessToken: 'gat', idToken: 'gid' },
    });

    const { result } = renderHook(() => useLogin(), { wrapper });

    await waitFor(() => expect(useSessionStore.getState().status).toBe('active'));
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/binder'));
    expect(result.current.errorMessage).toBeNull();
  });

  it('surfaces a retryable error on user cancellation and stays on Login', async () => {
    setAuthResponse({ type: 'cancel' });
    const { result } = renderHook(() => useLogin(), { wrapper });
    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(replaceSpy).not.toHaveBeenCalledWith('/binder');
  });

  it('surfaces a retryable error on AUTH_INVALID_GOOGLE_TOKEN and stays on Login', async () => {
    jest
      .spyOn(apiModule.apiClient, 'signInWithGoogle')
      .mockRejectedValue(new ApiError({ message: 'bad', status: 401, kind: 'AUTH_INVALID_GOOGLE_TOKEN' }));
    setAuthResponse({
      type: 'success',
      params: { id_token: 'gid' },
      authentication: { accessToken: 'gat', idToken: 'gid' },
    });

    const { result } = renderHook(() => useLogin(), { wrapper });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(replaceSpy).not.toHaveBeenCalledWith('/binder');
    expect(replaceSpy).not.toHaveBeenCalledWith('/access-denied');
  });

  it('navigates to /access-denied when the server returns AUTH_NOT_ALLOWLISTED', async () => {
    jest
      .spyOn(apiModule.apiClient, 'signInWithGoogle')
      .mockRejectedValue(new ApiError({ message: 'no', status: 403, kind: 'AUTH_NOT_ALLOWLISTED' }));
    setAuthResponse({
      type: 'success',
      params: { id_token: 'gid' },
      authentication: { accessToken: 'gat', idToken: 'gid' },
    });

    renderHook(() => useLogin(), { wrapper });

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/access-denied'));
  });

  it('redirects to /binder when an active session is already in store on mount', async () => {
    useSessionStore.setState({
      jwt: 'tok',
      iat: 1,
      userId: 'u',
      email: 'u@e.com',
      status: 'active',
    });

    renderHook(() => useLogin(), { wrapper });

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/binder'));
  });

  it('flips isSigningIn while the mutation is pending and back when settled', async () => {
    let resolveFn: (v: typeof ok) => void = () => {};
    jest
      .spyOn(apiModule.apiClient, 'signInWithGoogle')
      .mockImplementation(() => new Promise((res) => { resolveFn = res; }));
    setAuthResponse({
      type: 'success',
      params: { id_token: 'gid' },
      authentication: { accessToken: 'gat', idToken: 'gid' },
    });

    const { result } = renderHook(() => useLogin(), { wrapper });
    await waitFor(() => expect(result.current.isSigningIn).toBe(true));

    await act(async () => {
      resolveFn(ok);
    });
    await waitFor(() => expect(result.current.isSigningIn).toBe(false));
  });
});
