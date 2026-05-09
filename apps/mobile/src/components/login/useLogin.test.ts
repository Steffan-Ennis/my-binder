import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import { apiClient } from '@src/services/api/apiClient';
import { ApiError } from '@src/services/api/ApiError';
import { useSessionStore } from '@src/stores/sessionStore';

import { useLogin } from './useLogin';

type SignInResponse = Awaited<ReturnType<typeof GoogleSignin.signIn>>;

const successResponse = (idToken = 'gid'): SignInResponse =>
  ({ type: 'success', data: { idToken } } as unknown as SignInResponse);

const cancelledResponse = (): SignInResponse =>
  ({ type: 'cancelled', data: null } as unknown as SignInResponse);

const okSignInPayload = {
  user: { id: 'u1', email: 'u1@example.com' },
  token: 'jwt.value',
};

describe('useLogin', () => {
  let mockedSignIn: jest.SpyInstance<ReturnType<typeof GoogleSignin.signIn>>;
  let mockedSetItemAsync: jest.SpyInstance<ReturnType<typeof SecureStore.setItemAsync>>;
  let mockedSignInWithGoogle: jest.SpyInstance<ReturnType<typeof apiClient.signInWithGoogle>>;
  let mockedUseRouter: jest.SpyInstance<ReturnType<typeof ExpoRouter.useRouter>>;
  let replaceSpy: jest.Mock;
  let client: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

  beforeEach(() => {
    mockedSignIn = jest.spyOn(GoogleSignin, 'signIn');
    mockedSetItemAsync = jest
      .spyOn(SecureStore, 'setItemAsync')
      .mockResolvedValue(undefined);
    mockedSignInWithGoogle = jest.spyOn(apiClient, 'signInWithGoogle');

    replaceSpy = jest.fn();
    mockedUseRouter = jest.spyOn(ExpoRouter, 'useRouter').mockReturnValue({
      push: jest.fn(),
      replace: replaceSpy,
      back: jest.fn(),
    } as unknown as ReturnType<typeof ExpoRouter.useRouter>);

    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });

    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    });
  });

  afterEach(() => {
    client.cancelQueries();
    client.clear();
    client.unmount();
    mockedSignIn.mockRestore();
    mockedSetItemAsync.mockRestore();
    mockedSignInWithGoogle.mockRestore();
    mockedUseRouter.mockRestore();
  });

  it('exposes a stable onSignInPress that calls GoogleSignin.signIn', async () => {
    mockedSignIn.mockResolvedValue(cancelledResponse());

    const { result, rerender } = renderHook(() => useLogin(), { wrapper });
    await act(async () => {
      await result.current.onSignInPress();
    });
    expect(mockedSignIn).toHaveBeenCalled();
  });

  it('navigates to /binder after a successful sign-in', async () => {
    mockedSignIn.mockResolvedValue(successResponse());
    mockedSignInWithGoogle.mockResolvedValue(okSignInPayload);

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.onSignInPress();
    });

    await waitFor(() => expect(useSessionStore.getState().status).toBe('active'));
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/binder'));
    expect(result.current.errorMessage).toBeNull();
  });

  it('surfaces a retryable error on user cancellation and stays on Login', async () => {
    mockedSignIn.mockResolvedValue(cancelledResponse());

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.onSignInPress();
    });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(replaceSpy).not.toHaveBeenCalledWith('/binder');
  });

  it('surfaces a retryable error on AUTH_INVALID_GOOGLE_TOKEN and stays on Login', async () => {
    mockedSignIn.mockResolvedValue(successResponse());
    mockedSignInWithGoogle.mockRejectedValue(
      new ApiError({ message: 'bad', status: 401, kind: 'AUTH_INVALID_GOOGLE_TOKEN' }),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.onSignInPress();
    });

    await waitFor(() => expect(result.current.errorMessage).not.toBeNull());
    expect(replaceSpy).not.toHaveBeenCalledWith('/binder');
    expect(replaceSpy).not.toHaveBeenCalledWith('/access-denied');
  });

  it('navigates to /access-denied when the server returns AUTH_NOT_ALLOWLISTED', async () => {
    mockedSignIn.mockResolvedValue(successResponse());
    mockedSignInWithGoogle.mockRejectedValue(
      new ApiError({ message: 'no', status: 403, kind: 'AUTH_NOT_ALLOWLISTED' }),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.onSignInPress();
    });

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
    let resolveFn: (v: typeof okSignInPayload) => void = () => {};
    mockedSignIn.mockResolvedValue(successResponse());
    mockedSignInWithGoogle.mockImplementation(
      () => new Promise((res) => { resolveFn = res; }),
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.onSignInPress();
    });
    await waitFor(() => expect(result.current.isSigningIn).toBe(true));

    await act(async () => {
      resolveFn(okSignInPayload);
    });
    await waitFor(() => expect(result.current.isSigningIn).toBe(false));
  });
});
