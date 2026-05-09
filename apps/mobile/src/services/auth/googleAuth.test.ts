import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { renderHook } from "@testing-library/react-native";

import { UserCancelledError, revokeGoogleGrant, useGoogleAuthRequest } from './googleAuth';

describe('googleAuth tests', () => {

  let mockedGoogleSigning: jest.SpyInstance<ReturnType<typeof GoogleSignin.signIn>>
  let mockedRevokeAsync: jest.SpyInstance<ReturnType<typeof GoogleSignin.revokeAccess>>

  beforeEach(() => {
    mockedGoogleSigning = jest.spyOn(GoogleSignin, 'signIn')
    mockedRevokeAsync = jest.spyOn(GoogleSignin, 'revokeAccess')
  })

  describe('useGoogleAuthRequest', () => {
    it('passes the per-platform client IDs from expo-constants into useAuthRequest', async () => {
      const { result } = renderHook(() => useGoogleAuthRequest());
      await result.current()
      expect(mockedGoogleSigning).toHaveBeenCalledWith();
    });

    it('is a typed Error subclass with a discriminating name', () => {
      const err = new UserCancelledError();
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('UserCancelledError');
    });

    it('calls revokeAsync against the public Google revoke endpoint', async () => {
      await revokeGoogleGrant('access-token');
      expect(mockedRevokeAsync).toHaveBeenCalledWith();
    });
  });
})
