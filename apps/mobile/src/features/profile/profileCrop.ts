// Edit profile's crop request (D-79; FR-SOC-11). Change photo or Change cover picks a gallery photo, then
// `cropProfilePhoto` keeps it here and opens /crop?mode=avatar|cover, which reads it (a photo's URI is too
// big and untrusted for route params, as with pendingCrop). The Crop screen settles the request with the
// chosen frame (Done) or null (Cancel, or leaving any other way), and the promise resolves with that.
// One request at a time: a new one cancels the last.
import { router } from 'expo-router';
import { create } from 'zustand';

import type { PickedPhoto } from '@/features/capture/pickFromGallery';
import type { ProfileCrop, ProfileImageKind } from '@/lib/image/profileImage';

export type ProfileCropRequest = {
  id: number;
  kind: ProfileImageKind;
  photo: Pick<PickedPhoto, 'uri' | 'width' | 'height'>;
};

type ProfileCropState = {
  request: ProfileCropRequest | null;
};

export const useProfileCrop = create<ProfileCropState>()(() => ({ request: null }));

const resolvers = new Map<number, (crop: ProfileCrop | null) => void>();
let nextId = 1;

/** Settles request `id` (a no-op once settled): the frame from Done, or null when nothing should change. */
export function settleProfileCrop(id: number, crop: ProfileCrop | null): void {
  const resolve = resolvers.get(id);
  resolvers.delete(id);
  if (useProfileCrop.getState().request?.id === id) useProfileCrop.setState({ request: null });
  resolve?.(crop);
}

/** Opens Crop on `photo` at `kind`'s shape; resolves with the frame, or null when the person cancels. */
export function cropProfilePhoto(
  photo: ProfileCropRequest['photo'],
  kind: ProfileImageKind,
): Promise<ProfileCrop | null> {
  const last = useProfileCrop.getState().request;
  if (last) settleProfileCrop(last.id, null);
  const id = nextId++;
  const result = new Promise<ProfileCrop | null>((resolve) => resolvers.set(id, resolve));
  useProfileCrop.setState({
    request: { id, kind, photo: { uri: photo.uri, width: photo.width, height: photo.height } },
  });
  router.push({ pathname: '/crop', params: { mode: kind } });
  return result;
}
