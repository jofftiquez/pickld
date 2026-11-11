// Image pipeline (M2-09; FR-CAP-03, FR-PRV-01): crop a picked or captured photo to 3:4 and write
// the 1440×1920 photo and 480×640 thumbnail as WebP for upload.
//
// Location never leaves the phone (AGENTS rule 5): expo-image-manipulator decodes the photo to
// pixels and re-encodes it (iOS UIImage → SDImageWebPCoder, Android Bitmap.compress), which writes
// no metadata from the source. Each output is still read back and checked with
// `assertNoLocationMetadata` before it is returned, so an encoder change fails here instead of
// uploading GPS. The capture time is kept separately (`captureInfo`), never in the file.
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { cropRect34, FULL_SIZE, THUMB_SIZE, type CropRect } from './crop';
import { assertNoLocationMetadata } from './exif';

export type PreparedImage = { uri: string; width: number; height: number };
export type PreparedPhoto = { full: PreparedImage; thumb: PreparedImage };

const FULL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

type Releasable = { release(): void };

/**
 * Crops `uri` (a local file or `data:` URI) to 3:4 and writes the full photo and thumbnail as WebP
 * in the cache directory. `crop` is the Crop screen's frame in source pixels; without it the
 * largest centred 3:4 area is used. Throws `LocationMetadataError` (and deletes both outputs) if
 * an output still carries location metadata.
 */
export async function preparePhoto(uri: string, options: { crop?: CropRect } = {}): Promise<PreparedPhoto> {
  const refs: Releasable[] = [];
  const track = <T extends Releasable>(ref: T): T => {
    refs.push(ref);
    return ref;
  };
  const written: string[] = [];
  try {
    const source = track(await track(ImageManipulator.manipulate(uri)).renderAsync());
    const rect = cropRect34(source.width, source.height, options.crop);

    const full = track(await track(ImageManipulator.manipulate(source)).crop(rect).resize(FULL_SIZE).renderAsync());
    const fullOut = await full.saveAsync({ format: SaveFormat.WEBP, compress: FULL_QUALITY });
    written.push(fullOut.uri);

    const thumb = track(await track(ImageManipulator.manipulate(full)).resize(THUMB_SIZE).renderAsync());
    const thumbOut = await thumb.saveAsync({ format: SaveFormat.WEBP, compress: THUMB_QUALITY });
    written.push(thumbOut.uri);

    for (const out of written) assertNoLocationMetadata(await new File(out).bytes());

    return {
      full: { uri: fullOut.uri, width: fullOut.width, height: fullOut.height },
      thumb: { uri: thumbOut.uri, width: thumbOut.width, height: thumbOut.height },
    };
  } catch (error) {
    for (const out of written) {
      try {
        new File(out).delete();
      } catch {
        // Already gone; the original error matters more.
      }
    }
    throw error;
  } finally {
    for (const ref of refs) ref.release();
  }
}
