import { cropProfilePhoto } from '../profileCrop';
import { pickAndUploadProfileImage } from '../uploadProfileImage';
import { pickFromGallery } from '@/features/capture/pickFromGallery';
import { prepareProfileImage } from '@/lib/image/profileImage';
import { putWithUploadTask } from '@/lib/queue/uploader';

// Edit profile's Change photo / Change cover (FR-SOC-11, D-79): pick → Crop → prepare with the chosen
// frame → upload. Cancelling the picker or the crop uploads nothing.
jest.mock('@/features/capture/pickFromGallery', () => ({ pickFromGallery: jest.fn() }));
jest.mock('../profileCrop', () => ({ cropProfilePhoto: jest.fn() }));
jest.mock('@/lib/image/profileImage', () => ({ prepareProfileImage: jest.fn() }));
jest.mock('@/lib/queue/uploader', () => ({
  ...jest.requireActual('@/lib/queue/uploader'),
  putWithUploadTask: jest.fn(async () => undefined),
}));
const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } }),
}));

const picked = { uri: 'file:///picker/me.jpg', width: 3000, height: 4000, exif: null };
const crop = { rect: { originX: 0, originY: 200, width: 3000, height: 3000 }, basis: { width: 3000, height: 4000 } };
const signed = {
  key: 'avatars/u-1/a.jpg',
  url: 'https://r2.example/put',
  method: 'PUT',
  headers: { 'content-type': 'image/jpeg' },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(pickFromGallery).mockResolvedValue(picked);
  jest.mocked(cropProfilePhoto).mockResolvedValue(crop);
  jest.mocked(prepareProfileImage).mockResolvedValue({ uri: 'file:///cache/avatar.jpg', size: 1234 });
  mockInvoke.mockResolvedValue({ data: { data: { files: { file: signed } } }, error: null });
});

describe('pickAndUploadProfileImage', () => {
  it('opens Crop at the photo’s shape, prepares the photo with the chosen frame, then uploads it', async () => {
    await expect(pickAndUploadProfileImage('avatar')).resolves.toEqual({
      key: 'avatars/u-1/a.jpg',
      localUri: 'file:///cache/avatar.jpg',
    });
    expect(cropProfilePhoto).toHaveBeenCalledWith(picked, 'avatar');
    expect(prepareProfileImage).toHaveBeenCalledWith('file:///picker/me.jpg', 'avatar', crop);
    expect(mockInvoke).toHaveBeenCalledWith('upload-url', {
      body: { kind: 'avatar', file: { contentType: 'image/jpeg', size: 1234 } },
    });
    expect(putWithUploadTask).toHaveBeenCalledWith('file:///cache/avatar.jpg', expect.objectContaining(signed));
  });

  it('a cover opens Crop in cover mode', async () => {
    await pickAndUploadProfileImage('cover');
    expect(cropProfilePhoto).toHaveBeenCalledWith(picked, 'cover');
    expect(prepareProfileImage).toHaveBeenCalledWith('file:///picker/me.jpg', 'cover', crop);
  });

  it('Cancel on Crop uploads nothing', async () => {
    jest.mocked(cropProfilePhoto).mockResolvedValue(null);
    await expect(pickAndUploadProfileImage('avatar')).resolves.toBeNull();
    expect(prepareProfileImage).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(putWithUploadTask).not.toHaveBeenCalled();
  });

  it('cancelling the picker skips Crop and uploads nothing', async () => {
    jest.mocked(pickFromGallery).mockResolvedValue(null);
    await expect(pickAndUploadProfileImage('cover')).resolves.toBeNull();
    expect(cropProfilePhoto).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
