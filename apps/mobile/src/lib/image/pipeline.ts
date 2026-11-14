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

import { cropRect34, FULL_SIZE, MEDIUM_SIZE, scaleRect, THUMB_SIZE, type CropSpec } from './crop';
import { assertNoLocationMetadata } from './exif';

export type PreparedImage = { uri: string; width: number; height: number };
export type PreparedPhoto = { full: PreparedImage; thumb: PreparedImage };

const FULL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;
const MEDIUM_QUALITY = 0.8;

type Releasable = { release(): void };

/** The Crop screen's choices (see `CropSpec`); all optional. */
export type PrepareOptions = Partial<CropSpec>;

/**
 * Crops `uri` (a local file or `data:` URI) to 3:4 and writes the full photo and thumbnail as WebP
 * in the cache directory. The photo is first turned `rotate` degrees clockwise and mirrored when `flip`;
 * `crop` is the Crop screen's frame in that image's pixels (scaled from `cropBasis` when given); without
 * it the largest centred 3:4 area is used. Throws `LocationMetadataError` (and deletes both outputs) if
 * an output still carries location metadata.
 */
export async function preparePhoto(uri: string, options: PrepareOptions = {}): Promise<PreparedPhoto> {
  const refs: Releasable[] = [];
  const track = <T extends Releasable>(ref: T): T => {
    refs.push(ref);
    return ref;
  };
  const written: string[] = [];
  try {
    const turned = track(ImageManipulator.manipulate(uri));
    if (options.rotate) turned.rotate(options.rotate);
    if (options.flip) turned.flip('horizontal');
    const source = track(await turned.renderAsync());
    const area = options.crop && options.cropBasis ? scaleRect(options.crop, options.cropBasis, source) : options.crop;
    const rect = cropRect34(source.width, source.height, area);

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

/**
 * Writes the 1080 × 1440 feed copy of a prepared full photo (NFR-PERF-02) as WebP in the cache directory.
 * Made from the queue's full file just before upload, so the queue keeps only the full photo and thumbnail.
 * Like every output, it is checked for location metadata (and deleted if it has any).
 */
export async function prepareMedium(fullUri: string): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(fullUri);
  let image: Releasable | null = null;
  try {
    const rendered = await context.resize(MEDIUM_SIZE).renderAsync();
    image = rendered;
    const out = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: MEDIUM_QUALITY });
    try {
      assertNoLocationMetadata(await new File(out.uri).bytes());
    } catch (error) {
      new File(out.uri).delete();
      throw error;
    }
    return { uri: out.uri, width: out.width, height: out.height };
  } finally {
    image?.release();
    context.release();
  }
}

const FLIPPED_QUALITY = 0.95;

/**
 * Writes a copy of `uri` mirrored left to right, as JPEG in the cache directory, and returns its URI
 * (Mirror selfies off, D-66: a front-camera photo is flipped back before it is queued). The source file is
 * left alone. Like every manipulator output, the copy carries no metadata from the source; the capture
 * time travels separately.
 */
export async function flipPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  let image: Releasable | null = null;
  try {
    context.flip('horizontal');
    const rendered = await context.renderAsync();
    image = rendered;
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: FLIPPED_QUALITY });
    return out.uri;
  } finally {
    image?.release();
    context.release();
  }
}
