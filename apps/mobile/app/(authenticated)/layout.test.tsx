import { render } from '@testing-library/react-native';

import { useSessionStore } from '@src/stores/sessionStore';

import AuthenticatedLayout from './_layout';

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => ({ status: store.getState().status }),
  };
});

describe('(authenticated) layout (auth gate)', () => {
  beforeEach(() => {
    useSessionStore.setState({
      jwt: null,
      iat: null,
      userId: null,
      email: null,
      status: 'idle',
    });
  });

  it('redirects to /login when no active session', () => {
    const { toJSON } = render(<AuthenticatedLayout />);
    expect(JSON.stringify(toJSON())).toContain('/login');
  });

  it('renders the inner stack when session is active', () => {
    useSessionStore.setState({
      jwt: 'tok',
      iat: 1,
      userId: 'u',
      email: 'e@x.com',
      status: 'active',
    });
    const { toJSON } = render(<AuthenticatedLayout />);
    const serialized = JSON.stringify(toJSON());
    expect(serialized).not.toContain('/login');
  });
});