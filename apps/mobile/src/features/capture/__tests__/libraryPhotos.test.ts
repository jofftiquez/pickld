import { getPermissionsAsync, requestPermissionsAsync, type PermissionResponse } from 'expo-media-library';

import { askLibraryAccess, libraryAccess } from '../libraryPhotos';

// Photos access (FR-CAP-02, D-153): the camera never asks; a past day's page asks once, while undecided.
jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));

type Status = 'undetermined' | 'granted' | 'denied';
const permission = (status: Status, accessPrivileges: 'all' | 'limited' | 'none' = 'none'): PermissionResponse => ({
  status: status as PermissionResponse['status'],
  granted: status === 'granted',
  accessPrivileges,
  canAskAgain: status === 'undetermined',
  expires: 'never' as const,
});

beforeEach(() => {
  jest.mocked(getPermissionsAsync).mockReset();
  jest.mocked(requestPermissionsAsync).mockReset();
});

describe('askLibraryAccess', () => {
  it.each([
    ['all photos', permission('granted', 'all'), 'all'],
    ['limited', permission('granted', 'limited'), 'limited'],
  ] as const)('undecided: asks Apple once for photos only; %s opens the grid', async (_name, answer, access) => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(permission('undetermined'));
    jest.mocked(requestPermissionsAsync).mockResolvedValue(answer);
    await expect(askLibraryAccess()).resolves.toBe(access);
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(requestPermissionsAsync).toHaveBeenCalledWith(false, ['photo']);
  });

  it('undecided, then denied: no access, so the system picker opens', async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(permission('undetermined'));
    jest.mocked(requestPermissionsAsync).mockResolvedValue(permission('denied'));
    await expect(askLibraryAccess()).resolves.toBeNull();
  });

  it.each([
    ['denied', permission('denied'), null],
    ['granted', permission('granted', 'all'), 'all'],
    ['limited', permission('granted', 'limited'), 'limited'],
  ] as const)('already %s: never asks again', async (_name, current, access) => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(current);
    await expect(askLibraryAccess()).resolves.toBe(access);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('libraryAccess (the camera)', () => {
  it('never asks, even while undecided', async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(permission('undetermined'));
    await expect(libraryAccess()).resolves.toBeNull();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
