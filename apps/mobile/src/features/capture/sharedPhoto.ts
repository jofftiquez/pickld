// A photo from the Photos share sheet (FR-CAP-02; targets/share). The share extension copies the original
// photo and a small JSON (size and EXIF capture time) into the App Group's `shared-photos` folder, then opens
// /shared-photo?id=<id>. Here the app takes both out of the App Group: the photo moves to the cache (HEIC
// becomes a full-quality JPEG, as the gallery picker's own conversion does) and the App Group copies are
// deleted. From then on it is a gallery photo: same jar date rules, same Crop, same queue.
import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { z } from 'zod';

import { captureInfo } from '@/lib/image/captureTime';

import type { PickedPhoto } from './pickFromGallery';

const idSchema = z.uuid();

/** The untrusted `?id=` param as a handoff id, or null. */
export function parseSharedPhotoId(raw: unknown): string | null {
  const value = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

const manifestSchema = z.object({
  // `<id>.<ext>` in the same folder: never a path.
  photo: z.string().regex(/^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  DateTimeOriginal: z.string().optional(),
  OffsetTimeOriginal: z.string().optional(),
});

/** The App Group folder the extension writes to: `group.<app bundle id>` (app.config.ts). */
function handoffFile(name: string): File {
  const group = Paths.appleSharedContainers[`group.${Application.applicationId ?? ''}`];
  if (!group) throw new Error('No App Group container for shared photos');
  return new File(group, 'shared-photos', name);
}

function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // A leftover file in the App Group wastes space but loses nothing.
  }
}

async function take(id: string): Promise<PickedPhoto> {
  const manifestFile = handoffFile(`${id}.json`);
  const manifest = manifestSchema.parse(JSON.parse(await manifestFile.text()));
  if (!manifest.photo.startsWith(`${id}.`)) throw new Error('Shared photo manifest names another photo');
  const original = handoffFile(manifest.photo);
  const exif = { DateTimeOriginal: manifest.DateTimeOriginal, OffsetTimeOriginal: manifest.OffsetTimeOriginal };
  try {
    const ext = manifest.photo.split('.').pop() ?? '';
    if (manifest.width && manifest.height && ext !== 'heic' && ext !== 'heif') {
      const copy = new File(Paths.cache, `shared-${manifest.photo}`);
      deleteQuietly(copy);
      original.copy(copy);
      return { uri: copy.uri, width: manifest.width, height: manifest.height, exif };
    }
    // HEIC (or a size the extension couldn't read): render it upright as a JPEG at full size and quality.
    const context = ImageManipulator.manipulate(original.uri);
    try {
      const image = await context.renderAsync();
      try {
        const jpeg = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
        return { uri: jpeg.uri, width: jpeg.width, height: jpeg.height, exif };
      } finally {
        image.release();
      }
    } finally {
      context.release();
    }
  } finally {
    deleteQuietly(original);
    deleteQuietly(manifestFile);
  }
}

// One read per id: the App Group copies are gone after the first, and the screen may mount twice.
const taken = new Map<string, Promise<PickedPhoto>>();

/** The shared photo as a gallery pick (a cache file, its upright size and EXIF capture time). Rejects when
 * the handoff is missing or unreadable. */
export function takeSharedPhoto(id: string): Promise<PickedPhoto> {
  let photo = taken.get(id);
  if (!photo) {
    photo = take(id);
    taken.set(id, photo);
  }
  return photo;
}

export type SharedPhotoDay =
  /** Taken later than now (a wrong camera clock): refused, ensure_jar takes no future dates. */
  | { kind: 'future' }
  /** An earlier day than today in the phone zone: that day's jar, as Fill this jar (the server marks it
   * "Added later"). */
  | { kind: 'past'; localDate: string }
  /** Today, or no EXIF time: the open jar, as a camera photo (travel rule). */
  | { kind: 'today' };

/** Which day a shared photo goes to, from its EXIF capture time (`captureInfo`). `today` is today's date in
 * `phoneTz`. */
export function sharedPhotoDay(exif: unknown, phoneTz: string, now: Date, today: string): SharedPhotoDay {
  const info = captureInfo(exif, phoneTz, now);
  if (info.source === 'future') return { kind: 'future' };
  return info.localDate < today ? { kind: 'past', localDate: info.localDate } : { kind: 'today' };
}
