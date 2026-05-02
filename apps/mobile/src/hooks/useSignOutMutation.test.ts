import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { revokeAsync } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { ApiError } from '@src/services/api/ApiError';
import { useBinderStore } from '@src/stores/binderStore';
import { useSessionStore } from '@src/stores/sessionStore';

import { useSignOutMutation } from './useSignOutMutation';

const mockedDelete = SecureStore.deleteItemAsync as jest.Mock;
const mockedRevoke = revokeAsync as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;

let client: QueryClient;
const replaceSpy = jest.fn();

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  mockedDelete.mockReset();
  mockedRevoke.mockReset();
  replaceSpy.mockReset();
  mockedDelete.mockResolvedValue(undefined);
  mockedRevoke.mockResolvedValue(undefined);
  mockedUseRouter.mockReturnValue({ push: jest.fn(), replace: replaceSpy, back: jest.fn() });

  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  useBinderStore.setState({ currentPage: 5 });

  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } });
  client.setQueryData(['cards'], { pages: [{ cards: [] }], pageParams: [null] });

  jest.spyOn(apiModule.apiClient, 'signOut').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useSignOutMutation', () => {
  it('runs the full sign-out chain on success', async () => {
    jest.spyOn(apiModule.apiClient, 'signOut').mockResolvedValue(undefined);

    const { result } = renderHook(() => useSignOutMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ googleAccessToken: 'gat' });
    });

    expect(mockedDelete).toHaveBeenCalledWith('session.jwt');
    expect(mockedDelete).toHaveBeenCalledWith('session.iat');
    expect(mockedRevoke).toHaveBeenCalledWith(
      { token: 'gat' },
      { revocationEndpoint: 'https://oauth2.googleapis.com/revoke' },
    );
    expect(useSessionStore.getState().status).toBe('idle');
    expect(useSessionStore.getState().jwt).toBeNull();
    expect(useBinderStore.getState().currentPage).toBe(1);
    expect(client.getQueryData(['cards'])).toBeUndefined();
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  it('still runs cleanup chain when the server signOut fails', async () => {
    jest
      .spyOn(apiModule.apiClient, 'signOut')
      .mockRejectedValue(new ApiError({ message: 'boom', status: 500, kind: 'UNKNOWN' }));

    const { result } = renderHook(() => useSignOutMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ googleAccessToken: 'gat' });
    });

    expect(mockedDelete).toHaveBeenCalledWith('session.jwt');
    expect(mockedDelete).toHaveBeenCalledWith('session.iat');
    expect(useSessionStore.getState().status).toBe('idle');
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  it('skips the Google revoke call when no access token is supplied', async () => {
    jest.spyOn(apiModule.apiClient, 'signOut').mockResolvedValue(undefined);

    const { result } = renderHook(() => useSignOutMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ googleAccessToken: null });
    });

    expect(mockedRevoke).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('idle');
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });
});