import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import type {FC, PropsWithChildren} from 'react';

import { apiClient } from '@src/services/api/apiClient';
import { ApiError } from '@src/services/api/ApiError';
import { useBinderStore } from '@src/stores/binderStore';
import { useSessionStore } from '@src/stores/sessionStore';

import { useSignOutMutation } from './useSignOutMutation';

describe('useSignOutMutation', () => {
  let mockedDeleteItemAsync: jest.SpyInstance<ReturnType<typeof SecureStore.deleteItemAsync>>;
  let mockedRevokeAccess: jest.SpyInstance<ReturnType<typeof GoogleSignin.revokeAccess>>;
  let mockedUseRouter: jest.SpyInstance<ReturnType<typeof ExpoRouter.useRouter>>;
  let mockedSignOut: jest.SpyInstance<ReturnType<typeof apiClient.signOut>>;
  let replaceSpy: jest.Mock;
  let client: QueryClient;


  const wrapper: FC<PropsWithChildren> = ({ children }) => {
    return (
      <QueryClientProvider client={client} >
        {children}
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    replaceSpy = jest.fn();

    mockedDeleteItemAsync = jest.spyOn(SecureStore, 'deleteItemAsync');
    mockedRevokeAccess = jest.spyOn(GoogleSignin, 'revokeAccess');
    mockedSignOut = jest.spyOn(apiClient, 'signOut');

    // @ts-expect-error don't need to mock the full response
    mockedUseRouter = jest.spyOn(ExpoRouter, 'useRouter').mockReturnValue({
      push: jest.fn(),
      replace: replaceSpy,
      back: jest.fn(),
    });

    useSessionStore.setState({
      jwt: 'tok',
      iat: 1,
      userId: 'u',
      email: 'e@x.com',
      status: 'active',
    });
    useBinderStore.setState({ currentPage: 5 });

    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    });
    client.setQueryData(['cards'], { pages: [{ cards: [] }], pageParams: [null] });
  });

  afterEach(() => {
    mockedSignOut.mockRestore();
    mockedUseRouter.mockRestore();
    mockedRevokeAccess.mockReset()
    client.cancelQueries();
    client.clear();
    client.unmount();
  });

  it('runs the full sign-out chain on success', async () => {
    mockedSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSignOutMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ googleAccessToken: 'gat' });
    });

    expect(mockedDeleteItemAsync).toHaveBeenCalledWith('session.jwt');
    expect(mockedDeleteItemAsync).toHaveBeenCalledWith('session.iat');
    expect(mockedRevokeAccess).toHaveBeenCalledWith();
    expect(useSessionStore.getState().status).toBe('idle');
    expect(useSessionStore.getState().jwt).toBeNull();
    expect(useBinderStore.getState().currentPage).toBe(1);
    expect(client.getQueryData(['cards'])).toBeUndefined();
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  it('still runs cleanup chain when the server signOut fails', async () => {
    mockedSignOut.mockRejectedValue(
      new ApiError({ message: 'boom', status: 500, kind: 'UNKNOWN' }),
    );

    const { result } = renderHook(() => useSignOutMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ googleAccessToken: 'gat' });
    });

    expect(mockedDeleteItemAsync).toHaveBeenCalledWith('session.jwt');
    expect(mockedDeleteItemAsync).toHaveBeenCalledWith('session.iat');
    expect(useSessionStore.getState().status).toBe('idle');
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  it('skips the Google revoke call when no access token is supplied', async () => {
    mockedSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSignOutMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ googleAccessToken: null });
    });

    expect(mockedRevokeAccess).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('idle');
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });
});
