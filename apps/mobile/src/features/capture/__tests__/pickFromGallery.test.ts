// The gallery picker (FR-CAP-02, D-26): one image, no system editing, EXIF for the capture time; cancel is null.
import { launchImageLibraryAsync } from 'expo-image-picker';

import { pickFromGallery } from '../pickFromGallery';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

beforeEach(() => jest.mocked(launchImageLibraryAsync).mockReset());

it('opens the picker for one image with EXIF and no editing UI', async () => {
  jest.mocked(launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
  await pickFromGallery();
  expect(launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaTypes: 'images',
      allowsEditing: false,
      allowsMultipleSelection: false,
      selectionLimit: 1,
      exif: true,
    }),
  );
});

it('cancel resolves null', async () => {
  jest.mocked(launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
  await expect(pickFromGallery()).resolves.toBeNull();
});

it('returns the photo file, size and EXIF', async () => {
  const exif = { DateTimeOriginal: '2026:11:08 19:30:00' };
  jest.mocked(launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///picker/a.jpg', width: 4032, height: 3024, exif }],
  });
  await expect(pickFromGallery()).resolves.toEqual({ uri: 'file:///picker/a.jpg', width: 4032, height: 3024, exif });
});

it('a photo without EXIF has null EXIF (taken now)', async () => {
  jest.mocked(launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///picker/b.png', width: 10, height: 20 }],
  });
  await expect(pickFromGallery()).resolves.toMatchObject({ exif: null });
});
