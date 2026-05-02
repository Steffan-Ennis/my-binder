import * as SecureStore from 'expo-secure-store';

import { clearSession, readSession, writeSession } from './sessionStorage';

const mockedGet = SecureStore.getItemAsync as jest.Mock;
const mockedSet = SecureStore.setItemAsync as jest.Mock;
const mockedDelete = SecureStore.deleteItemAsync as jest.Mock;

beforeEach(() => {
  mockedGet.mockReset();
  mockedSet.mockReset();
  mockedDelete.mockReset();
});

describe('sessionStorage.readSession', () => {
  it('returns null when no JWT is stored', async () => {
    mockedGet.mockResolvedValue(null);
    expect(await readSession()).toBeNull();
  });

  it('returns the stored session when both keys are present', async () => {
    mockedGet.mockImplementation((key: string) =>
      Promise.resolve(key === 'session.jwt' ? 'eyJ.token' : '1700000000'),
    );

    expect(await readSession()).toEqual({ jwt: 'eyJ.token', iat: 1_700_000_000 });
  });

  it('returns null when iat is non-numeric', async () => {
    mockedGet.mockImplementation((key: string) =>
      Promise.resolve(key === 'session.jwt' ? 'eyJ' : 'not-a-number'),
    );

    expect(await readSession()).toBeNull();
  });
});

describe('sessionStorage.writeSession', () => {
  it('writes both keys via expo-secure-store', async () => {
    mockedSet.mockResolvedValue(undefined);
    await writeSession({ jwt: 'eyJ.token', iat: 1_700_000_000 });
    expect(mockedSet).toHaveBeenCalledWith('session.jwt', 'eyJ.token');
    expect(mockedSet).toHaveBeenCalledWith('session.iat', '1700000000');
    expect(mockedSet).toHaveBeenCalledTimes(2);
  });
});

describe('sessionStorage.clearSession', () => {
  it('deletes both keys via expo-secure-store (no AsyncStorage fallback)', async () => {
    mockedDelete.mockResolvedValue(undefined);
    await clearSession();
    expect(mockedDelete).toHaveBeenCalledWith('session.jwt');
    expect(mockedDelete).toHaveBeenCalledWith('session.iat');
    expect(mockedDelete).toHaveBeenCalledTimes(2);
  });
});