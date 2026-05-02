import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import { useAccessDenied } from './useAccessDenied';

const mockedDelete = SecureStore.deleteItemAsync as jest.Mock;
const mockedUseRouter = useRouter as jest.Mock;

let client: QueryClient;
const replaceSpy = jest.fn();

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

beforeEach(() => {
  mockedDelete.mockReset();
  mockedDelete.mockResolvedValue(undefined);
  replaceSpy.mockReset();
  mockedUseRouter.mockReturnValue({ push: jest.fn(), replace: replaceSpy, back: jest.fn() });
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } });
  jest.spyOn(apiModule.apiClient, 'signOut').mockResolvedValue(undefined);
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('useAccessDenied', () => {
  it('exposes a non-empty contactHref', () => {
    const { result } = renderHook(() => useAccessDenied(), { wrapper });
    expect(typeof result.current.contactHref).toBe('string');
    expect(result.current.contactHref.length).toBeGreaterThan(0);
  });

  it('onTryDifferentAccount signs out and routes to Login', async () => {
    const { result } = renderHook(() => useAccessDenied(), { wrapper });

    await act(async () => {
      await result.current.onTryDifferentAccount();
    });

    await waitFor(() => expect(useSessionStore.getState().status).toBe('idle'));
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  it('returns reference-stable handlers across re-renders', () => {
    const { result, rerender } = renderHook(() => useAccessDenied(), { wrapper });
    const firstHandler = result.current.onTryDifferentAccount;
    const firstHref = result.current.contactHref;
    rerender(undefined);
    expect(result.current.onTryDifferentAccount).toBe(firstHandler);
    expect(result.current.contactHref).toBe(firstHref);
  });
});