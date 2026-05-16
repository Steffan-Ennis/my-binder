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
      cards: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Lightning Bolt',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
      total: 1,
      nextCursor: null,
    };
    fetchMock.mockResolvedValue(ok(body));
    const result = await apiClient.getCards();
    expect(result).toEqual(body);
  });

  it('appends the cursor query string when supplied', async () => {
    fetchMock.mockResolvedValue(ok({ cards: [], total: 0, nextCursor: null }));
    await apiClient.getCards('opaque-token');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/cards?cursor=opaque-token'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('apiClient.getCardImages', () => {
  const IMAGES = {
    small: 'https://cards.scryfall.io/small/front/e/7/x.jpg',
    medium: 'https://cards.scryfall.io/normal/front/e/7/x.jpg',
    large: 'https://cards.scryfall.io/large/front/e/7/x.jpg',
  };
  const ID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';

  it('returns the parsed CardImages on 200', async () => {
    fetchMock.mockResolvedValue(ok(IMAGES));
    const result = await apiClient.getCardImages(ID);
    expect(result).toEqual(IMAGES);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/cards/images/${ID}`),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ApiError(CARD_NOT_FOUND) on 404', async () => {
    fetchMock.mockResolvedValue(err(404, { error: 'CARD_NOT_FOUND', message: 'nope' }));
    const e = await apiClient.getCardImages(ID).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).kind).toBe('CARD_NOT_FOUND');
    expect((e as ApiError).status).toBe(404);
  });

  it('throws ApiError(PROVIDER_UNAVAILABLE) on 503', async () => {
    fetchMock.mockResolvedValue(err(503, { error: 'PROVIDER_UNAVAILABLE', message: 'down' }));
    const e = await apiClient.getCardImages(ID).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).kind).toBe('PROVIDER_UNAVAILABLE');
    expect((e as ApiError).status).toBe(503);
  });
});