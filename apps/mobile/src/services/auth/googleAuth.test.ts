import { revokeAsync } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

import { UserCancelledError, revokeGoogleGrant, useGoogleAuthRequest } from './googleAuth';

const mockedUseAuthRequest = Google.useAuthRequest as jest.Mock;
const mockedRevokeAsync = revokeAsync as jest.Mock;

beforeEach(() => {
  mockedUseAuthRequest.mockReset();
  mockedRevokeAsync.mockReset();
});

describe('useGoogleAuthRequest', () => {
  it('passes the per-platform client IDs from expo-constants into useAuthRequest', () => {
    mockedUseAuthRequest.mockReturnValue([null, null, jest.fn()]);
    useGoogleAuthRequest();
    expect(mockedUseAuthRequest).toHaveBeenCalledWith({
      iosClientId: 'ios.test',
      androidClientId: 'android.test',
      webClientId: 'web.test',
    });
  });
});

describe('revokeGoogleGrant', () => {
  it('calls revokeAsync against the public Google revoke endpoint', async () => {
    mockedRevokeAsync.mockResolvedValue(undefined);
    await revokeGoogleGrant('access-token');
    expect(mockedRevokeAsync).toHaveBeenCalledWith(
      { token: 'access-token' },
      { revocationEndpoint: 'https://oauth2.googleapis.com/revoke' },
    );
  });

  it('is a no-op when the token is empty (avoid a 400 from Google)', async () => {
    await revokeGoogleGrant('');
    expect(mockedRevokeAsync).not.toHaveBeenCalled();
  });
});

describe('UserCancelledError', () => {
  it('is a typed Error subclass with a discriminating name', () => {
    const err = new UserCancelledError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UserCancelledError');
  });
});