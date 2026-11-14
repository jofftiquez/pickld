// Change avatar or Change cover (M3-15; FR-SOC-11): pick a photo, frame it on the Crop screen (a square
// for the avatar, 5:2 for the cover; D-79), prepare it (that crop, JPEG, no location), ask fn:upload-url
// for a short-lived PUT URL (kind avatar | cover; refuses suspended users) and upload it. The returned key
// is written to profiles on Save; the database checks it is this person's own avatars/<id>/ or
// covers/<id>/ key (0018), so nobody can point their profile at someone else's photo.
import { z } from 'zod';

import { pickFromGallery } from '@/features/capture/pickFromGallery';
import { cropProfilePhoto } from '@/features/profile/profileCrop';
import { prepareProfileImage, type ProfileImageKind } from '@/lib/image/profileImage';
import { putWithUploadTask, signedUploadSchema } from '@/lib/queue/uploader';
import { getSupabase } from '@/lib/supabase';

const response = z.object({ data: z.object({ files: z.object({ file: signedUploadSchema }) }) });

export type UploadedImage = { key: string; localUri: string };

export type PreparedImage = { uri: string; size: number };

/** A picked photo prepared on the phone (centred crop, JPEG, no location), or null when the person cancels.
 * Onboarding's About you uses it; Edit profile frames the photo first (pickAndUploadProfileImage). */
export async function pickProfileImage(kind: ProfileImageKind): Promise<PreparedImage | null> {
  const picked = await pickFromGallery();
  return picked ? prepareProfileImage(picked.uri, kind) : null;
}

/** Uploads a prepared photo and returns its key. Needs an active profile (fn:upload-url, D-11). */
export async function uploadProfileImage(prepared: PreparedImage, kind: ProfileImageKind): Promise<string> {
  const { data, error } = await getSupabase().functions.invoke<unknown>('upload-url', {
    body: { kind, file: { contentType: 'image/jpeg', size: prepared.size } },
  });
  if (error) throw new Error(error.message);
  const { file } = response.parse(data).data.files;
  await putWithUploadTask(prepared.uri, file);
  return file.key;
}

/** The uploaded photo's key and local preview, or null when the person cancels the picker or the crop. */
export async function pickAndUploadProfileImage(kind: ProfileImageKind): Promise<UploadedImage | null> {
  const picked = await pickFromGallery();
  if (!picked) return null;
  const crop = await cropProfilePhoto(picked, kind);
  if (!crop) return null;
  const prepared = await prepareProfileImage(picked.uri, kind, crop);
  return { key: await uploadProfileImage(prepared, kind), localUri: prepared.uri };
}
