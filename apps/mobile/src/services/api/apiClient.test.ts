import { useSessionStore } from '@src/stores/sessionStore';

import { ApiError } from './ApiError';
import { apiClient } from './apiClient';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const ok = (body: unknown, status = 200): Response =>
  ({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const err = (status: number, body: unknown): Response =>
  ({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

beforeEach(() => {
  fetchMock.mockReset();
  useSessionStore.setState({
    jwt: null,
    iat: null,
    userId: null,
    email: null,
    status: 'idle',
  });
});

describe('apiClient bearer attachment', () => {
  it('attaches Authorization: Bearer when status is active', async () => {
    useSessionStore.setState({
      jwt: 'tok',
      iat: 1,
      userId: 'u',
      email: 'e@x.com',
      status: 'active',
    });
    fetchMock.mockResolvedValue(ok({ user: { id: 'u', email: 'e@x.com' } }));

    await apiClient.getMe();

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('omits Authorization when no active session', async () => {
    fetchMock.mockResolvedValue(ok({ user: { id: 'u', email: 'e@x.com' } }));
    await apiClient.getMe();
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe('apiClient.signInWithGoogle', () => {
  it('POSTs the idToken to /auth/google and returns the validated response', async () => {
    const body = { user: { id: 'u', email: 'e@x.com' }, token: 'jwt' };
    fetchMock.mockResolvedValue(ok(body));

    const result = await apiClient.signInWithGoogle({ idToken: 'gid' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'gid' }) }),
    );
    expect(result).toEqual(body);
  });

  it('throws ApiError(AUTH_INVALID_GOOGLE_TOKEN) on 401 with that code', async () => {
    fetchMock.mockResolvedValue(err(401, { code: 'AUTH_INVALID_GOOGLE_TOKEN', message: 'bad' }));
    await expect(apiClient.signInWithGoogle({ idToken: 'gid' })).rejects.toMatchObject({
      kind: 'AUTH_INVALID_GOOGLE_TOKEN',
      status: 401,
    });
  });

  it('throws ApiError(AUTH_NOT_ALLOWLISTED) on 403', async () => {
    fetchMock.mockResolvedValue(err(403, { code: 'AUTH_NOT_ALLOWLISTED', message: 'no' }));
    await expect(apiClient.signInWithGoogle({ idToken: 'gid' })).rejects.toMatchObject({
      kind: 'AUTH_NOT_ALLOWLISTED',
      status: 403,
    });
  });

  it('throws ApiError(NETWORK_OFFLINE) on fetch rejection', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const e = await apiClient.signInWithGoogle({ idToken: 'gid' }).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).kind).toBe('NETWORK_OFFLINE');
  });

  it('throws ApiError(SCHEMA_VALIDATION_ERROR) when response is missing required fields', async () => {
    fetchMock.mockResolvedValue(ok({ unexpected: 'shape' }));
    const e = await apiClient.signInWithGoogle({ idToken: 'gid' }).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).kind).toBe('SCHEMA_VALIDATION_ERROR');
  });
});

describe('apiClient.signOut', () => {
  it('POSTs to /auth/signout and resolves on 204', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    } as unknown as Response);

    await expect(apiClient.signOut()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/signout'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('apiClient.getCards', () => {
  it('returns the validated card list', async () => {
    const body = {
      cards: [{ id: 'c1', name: 'Lightning Bolt', frontFaceImageUrl: 'https://img/1' }],
      nextCursor: null,
    };
    fetchMock.mockResolvedValue(ok(body));
    const result = await apiClient.getCards();
    expect(result).toEqual(body);
  });

  it('appends the cursor query string when supplied', async () => {
    fetchMock.mockResolvedValue(ok({ cards: [], nextCursor: null }));
    await apiClient.getCards('opaque-token');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/cards?cursor=opaque-token'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
});