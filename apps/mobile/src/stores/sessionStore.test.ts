import { useSessionStore } from './sessionStore';

const reset = () => {
  useSessionStore.setState({
    jwt: null,
    iat: null,
    userId: null,
    email: null,
    status: 'idle',
  });
};

describe('sessionStore', () => {
  beforeEach(reset);

  it('starts in the idle status with no fields populated', () => {
    const s = useSessionStore.getState();
    expect(s.status).toBe('idle');
    expect(s.jwt).toBeNull();
    expect(s.iat).toBeNull();
    expect(s.userId).toBeNull();
    expect(s.email).toBeNull();
  });

  it('setSession transitions to active and populates every field', () => {
    useSessionStore.getState().setSession({
      jwt: 'jwt.token.value',
      iat: 1_700_000_000,
      userId: 'u1',
      email: 'u1@example.com',
    });

    const s = useSessionStore.getState();
    expect(s.status).toBe('active');
    expect(s.jwt).toBe('jwt.token.value');
    expect(s.iat).toBe(1_700_000_000);
    expect(s.userId).toBe('u1');
    expect(s.email).toBe('u1@example.com');
  });

  it('clearSession returns the store to idle', () => {
    useSessionStore.getState().setSession({
      jwt: 'jwt',
      iat: 1,
      userId: 'u',
      email: 'u@e.com',
    });
    useSessionStore.getState().clearSession();

    const s = useSessionStore.getState();
    expect(s.status).toBe('idle');
    expect(s.jwt).toBeNull();
    expect(s.userId).toBeNull();
  });

  it('markExpired flips status to expired without clearing fields', () => {
    useSessionStore.getState().setSession({
      jwt: 'jwt',
      iat: 1,
      userId: 'u',
      email: 'u@e.com',
    });
    useSessionStore.getState().markExpired();

    const s = useSessionStore.getState();
    expect(s.status).toBe('expired');
    expect(s.jwt).toBe('jwt');
  });

  it('selector subscriptions fire on the selected slice only', () => {
    const calls: SessionStatus[] = [];
    type SessionStatus = ReturnType<typeof useSessionStore.getState>['status'];

    const unsubscribe = useSessionStore.subscribe((s) => s.status, (status) => calls.push(status));

    useSessionStore.getState().setSession({
      jwt: 'jwt',
      iat: 1,
      userId: 'u',
      email: 'u@e.com',
    });
    useSessionStore.getState().markExpired();
    unsubscribe();
    useSessionStore.getState().clearSession();

    expect(calls).toEqual(['active', 'expired']);
  });
});