import { router } from 'expo-router';

import { cropProfilePhoto, settleProfileCrop, useProfileCrop } from '../profileCrop';

// The handoff between Edit profile and /crop?mode=avatar|cover (D-79).
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const photo = { uri: 'file:///picker/me.jpg', width: 3000, height: 4000 };
const crop = { rect: { originX: 0, originY: 0, width: 3000, height: 3000 }, basis: { width: 3000, height: 4000 } };

beforeEach(() => {
  useProfileCrop.setState({ request: null });
  jest.mocked(router.push).mockClear();
});

describe('cropProfilePhoto', () => {
  it('keeps the photo for Crop, opens it in the right mode and resolves with the frame from Done', async () => {
    const result = cropProfilePhoto(photo, 'cover');
    const request = useProfileCrop.getState().request;
    expect(request).toMatchObject({ kind: 'cover', photo });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/crop', params: { mode: 'cover' } });
    settleProfileCrop(request!.id, crop);
    await expect(result).resolves.toEqual(crop);
    expect(useProfileCrop.getState().request).toBeNull();
  });

  it('settles once: a later settle (the screen closing after Done) changes nothing', async () => {
    const result = cropProfilePhoto(photo, 'avatar');
    const { id } = useProfileCrop.getState().request!;
    settleProfileCrop(id, crop);
    settleProfileCrop(id, null);
    await expect(result).resolves.toEqual(crop);
  });

  it('a new request cancels the last', async () => {
    const first = cropProfilePhoto(photo, 'avatar');
    const second = cropProfilePhoto(photo, 'cover');
    await expect(first).resolves.toBeNull();
    const { id, kind } = useProfileCrop.getState().request!;
    expect(kind).toBe('cover');
    settleProfileCrop(id, crop);
    await expect(second).resolves.toEqual(crop);
  });
});
