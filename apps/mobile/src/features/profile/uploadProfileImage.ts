// Change avatar or Change cover (M3-15; FR-SOC-11): pick a photo, prepare it (centred crop, JPEG, no
// location), ask fn:upload-url for a short-lived PUT URL (kind avatar | cover; refuses suspended users)
// and upload it. The returned key is written to profiles on Save; the database checks it is this person's
// own avatars/<id>/ or covers/<id>/ key (0018), so nobody can point their profile at someone else's photo.
import { z } from 'zod';

import { pickFromGallery } from '@/features/capture/pickFromGallery';
import { prepareProfileImage, type ProfileImageKind } from '@/lib/image/profileImage';
import { putWithUploadTask, signedUploadSchema } from '@/lib/queue/uploader';
import { getSupabase } from '@/lib/supabase';

const response = z.object({ data: z.object({ files: z.object({ file: signedUploadSchema }) }) });

export type UploadedImage = { key: string; localUri: string };

/** The uploaded photo's key and local preview, or null when the person cancels the picker. */
export async function pickAndUploadProfileImage(kind: ProfileImageKind): Promise<UploadedImage | null> {
  const picked = await pickFromGallery();
  if (!picked) return null;
  const prepared = await prepareProfileImage(picked.uri, kind);
  const { data, error } = await getSupabase().functions.invoke<unknown>('upload-url', {
    body: { kind, file: { contentType: 'image/jpeg', size: prepared.size } },
  });
  if (error) throw new Error(error.message);
  const { file } = response.parse(data).data.files;
  await putWithUploadTask(prepared.uri, file);
  return { key: file.key, localUri: prepared.uri };
}
