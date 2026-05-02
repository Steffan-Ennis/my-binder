import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useMeQuery } from './useMeQuery';

jest.mock('./useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'getMe').mockReset();
});

afterEach(() => {
  // Cancel all in-flight queries and remove cached data + subscriptions so the
  // QueryClient does not leak timers/listeners past the test (the cause of
  // "Jest did not exit one second after the test run has completed").
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useMeQuery', () => {
  it('fetches /auth/me when session is active', async () => {
    const spy = jest
      .spyOn(apiModule.apiClient, 'getMe')
      .mockResolvedValue({ user: { id: 'u', email: 'e@x.com' } });

    const { result } = renderHook(() => useMeQuery(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalled();
    expect(result.current.data?.user.id).toBe('u');
  });

  it('does not fetch when session is idle', () => {
    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });
    const spy = jest.spyOn(apiModule.apiClient, 'getMe');
    renderHook(() => useMeQuery(), { wrapper });
    expect(spy).not.toHaveBeenCalled();
  });
});
