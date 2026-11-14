// The ThumbHash placeholder for a new photo (NFR-PERF-02), made on the phone from its 480 × 640 thumbnail and sent
// with the upload (fn:upload-url stores it, migration 0121). expo-image shrinks the image to at most 100 × 100
// before encoding, so this takes milliseconds.
import { Image } from 'expo-image';

/** What fn:upload-url accepts: base64, as generateThumbhashAsync writes it. */
export const THUMBHASH_PATTERN = /^[A-Za-z0-9+/]{8,64}={0,2}$/;

/** The ThumbHash of a local image, or null when it can't be made; a malformed one would fail the upload. */
export async function makeThumbhash(uri: string): Promise<string | null> {
  try {
    const hash = await Image.generateThumbhashAsync(uri);
    return THUMBHASH_PATTERN.test(hash) ? hash : null;
  } catch {
    return null;
  }
}
