import { render } from '@testing-library/react-native';

import { useSessionStore } from '@src/stores/sessionStore';

import Index from './index';

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => ({ status: store.getState().status }),
  };
});

describe('app/index entry route', () => {
  beforeEach(() => {
    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });
  });

  it('redirects to /login when no session is active', () => {
    const { toJSON } = render(<Index />);
    expect(JSON.stringify(toJSON())).toContain('/login');
  });

  it('redirects to /binder when an active session is hydrated', () => {
    useSessionStore.setState({
      jwt: 'tok',
      iat: 1,
      userId: 'u',
      email: 'e@x.com',
      status: 'active',
    });
    const { toJSON } = render(<Index />);
    expect(JSON.stringify(toJSON())).toContain('/binder');
  });
});