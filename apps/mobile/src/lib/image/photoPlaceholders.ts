// Blurred placeholders while photos load (NFR-PERF-02). fn:photo-urls returns a ThumbHash (about 25 bytes)
// next to each thumbnail URL it signs; the screens that ask for URLs hand the answer to `rememberPlaceholders`,
// and the photo views draw `photoPlaceholder(uri)` until the real photo arrives. Each upload has its own folder
// (`moments/<user>/<upload>/full|medium|thumb.jpg`, _shared/object_keys.ts), so one hash covers all its sizes.
import type { ImageSource } from 'expo-image';
import { z } from 'zod';

import { photoCacheKey } from './photoCache';

/** Enough for every photo a long session scrolls past; the oldest are forgotten first. */
export const MAX_PLACEHOLDERS = 5000;

const hashes = new Map<string, string>();

const momentUrls = z.object({
  thumb: z.string().nullable().optional(),
  thumbhash: z.string().optional(),
  pendingThumb: z.string().optional(),
  pendingThumbhash: z.string().optional(),
});
const photoUrlsBody = z.object({ data: z.object({ moments: z.array(z.unknown()) }) });

/** The upload folder of a signed photo link, shared by its full, medium and thumb copies. */
function folderOf(uri: string): string | null {
  const key = photoCacheKey(uri);
  if (!key) return null;
  const slash = key.lastIndexOf('/');
  return slash > 0 ? key.slice(0, slash) : null;
}

function remember(thumb: string | null | undefined, hash: string | undefined): void {
  const folder = thumb && hash ? folderOf(thumb) : null;
  if (!folder || !hash) return;
  hashes.delete(folder); // re-inserted last, so it counts as recently seen
  hashes.set(folder, hash);
  if (hashes.size > MAX_PLACEHOLDERS) {
    const oldest = hashes.keys().next().value;
    if (oldest !== undefined) hashes.delete(oldest);
  }
}

/** Keeps the placeholders in an fn:photo-urls answer. Anything else is ignored. */
export function rememberPlaceholders(body: unknown): void {
  const parsed = photoUrlsBody.safeParse(body);
  if (!parsed.success) return;
  for (const raw of parsed.data.data.moments) {
    const m = momentUrls.safeParse(raw);
    if (!m.success) continue;
    remember(m.data.thumb, m.data.thumbhash);
    remember(m.data.pendingThumb, m.data.pendingThumbhash);
  }
}

/** An expo-image placeholder for a photo link, or undefined when there is none (old photos, local files). */
export function photoPlaceholder(uri: string | null | undefined): ImageSource | undefined {
  const folder = uri ? folderOf(uri) : null;
  const thumbhash = folder ? hashes.get(folder) : undefined;
  return thumbhash ? { thumbhash } : undefined;
}

/** Forgets every placeholder (sign out, tests). */
export function forgetPlaceholders(): void {
  hashes.clear();
}
