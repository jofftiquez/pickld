// Avatar and cover photos for Edit profile (M3-15; FR-SOC-11): the largest centred square (avatar) or 5:2
// band (cover), resized and re-encoded as JPEG. Like the moment pipeline, re-encoding writes no metadata
// from the source, and each output is read back and checked so location never leaves the phone (rule 5).
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { CropRect } from './crop';
import { assertNoLocationMetadata } from './exif';

export type ProfileImageKind = 'avatar' | 'cover';

/** Output size per kind. fn:upload-url allows 2 MB avatars and 5 MB covers. */
export const PROFILE_IMAGE_SIZE: Record<ProfileImageKind, { width: number; height: number }> = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1500, height: 600 },
};

const QUALITY = 0.85;

/** The largest centred rectangle with `aspect` (width / height) inside a `width` × `height` image. */
export function centerCrop(width: number, height: number, aspect: number): CropRect {
  const cropWidth = Math.min(width, Math.round(height * aspect));
  const cropHeight = Math.min(height, Math.round(cropWidth / aspect));
  return {
    originX: Math.floor((width - cropWidth) / 2),
    originY: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

/** Writes the prepared JPEG to the cache directory; throws (and deletes it) if it still carries location. */
export async function prepareProfileImage(uri: string, kind: ProfileImageKind): Promise<{ uri: string; size: number }> {
  const target = PROFILE_IMAGE_SIZE[kind];
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const rect = centerCrop(source.width, source.height, target.width / target.height);
  const context = ImageManipulator.manipulate(source).crop(rect).resize(target);
  const image = await context.renderAsync();
  try {
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
    const file = new File(out.uri);
    try {
      assertNoLocationMetadata(await file.bytes());
    } catch (error) {
      file.delete();
      throw error;
    }
    return { uri: out.uri, size: file.size };
  } finally {
    image.release();
    context.release();
    source.release();
  }
}
