// The phone's photo cache (NFR-PERF-02). fn:photo-urls signs a new link every time it is asked, with a new
// expiry, so a cache keyed by the link (expo-image's default) downloaded every photo again after each refetch.
// Photos are cached by their object key instead: every upload gets a new key and an object never changes
// under its key (_shared/object_keys.ts), so a cached photo is always the right one. Who may see a photo is
// still decided by fn:photo-urls: a screen only has a key to draw once it has been given a signed link.
import { File, Paths } from 'expo-file-system';
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { PHOTO_RETRY_DELAYS_MS } from './usePhotoRetry';

/** `<origin>/<object key>?exp=…&sig=…`, the photo Worker's signed link (D-12). */
const SIGNED_LINK = /^https?:\/\/[^/?#]+\/([^?#]+)\?(?:[^#]*&)?sig=/;

/** A photo cache of this size keeps weeks of feeds at about 30–200 KB a photo. */
export const PHOTO_CACHE_MAX_BYTES = 500 * 1024 * 1024;

/** The object key a signed photo link points to, or null for anything else (a local file, sticker art). */
export function photoCacheKey(uri: string): string | null {
  const match = SIGNED_LINK.exec(uri);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** An expo-image source for a photo: a signed link is cached under its object key, anything else as is. */
export function photoSource(uri: string): ImageSource {
  const cacheKey = photoCacheKey(uri);
  return cacheKey ? { uri, cacheKey } : { uri };
}

const pending = new Map<string, Promise<string | null>>();

function asFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * A local file for a photo: the cached copy, downloaded into the cache first when there is none. For code
 * that reads the file itself instead of drawing it with expo-image (Skia draws filtered moments). Local URIs
 * come back unchanged; null when the download fails.
 */
export function cachedPhotoFile(uri: string): Promise<string | null> {
  const key = photoCacheKey(uri);
  if (!key) return Promise.resolve(uri);
  const running = pending.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const cached = await Image.getCachePathAsync(key);
      if (cached) return asFileUri(cached);
      const temp = new File(Paths.cache, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      try {
        await File.downloadFileAsync(uri, temp);
        await Image.writeToCacheAsync(temp.uri, key);
      } finally {
        if (temp.exists) temp.delete();
      }
      const stored = await Image.getCachePathAsync(key);
      return stored ? asFileUri(stored) : null;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}

/**
 * `cachedPhotoFile` as a hook: null until the local file is ready (or when it can't be had). A failed
 * download is tried again (`PHOTO_RETRY_DELAYS_MS`) with the newest link, which may have been re-signed.
 */
export function useCachedPhotoFile(uri: string | null | undefined): string | null {
  const key = uri ? photoCacheKey(uri) : null;
  // A re-signed link for the same photo keeps the file it already has (the key is the same).
  const [file, setFile] = useState<{ key: string; file: string | null } | null>(null);
  const [retry, setRetry] = useState<{ key: string | null; attempt: number }>({ key, attempt: 0 });
  const attempt = retry.key === key ? retry.attempt : 0;
  useEffect(() => {
    if (!uri || !key) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void cachedPhotoFile(uri).then((f) => {
      if (!live) return;
      setFile({ key, file: f });
      if (f === null && attempt < PHOTO_RETRY_DELAYS_MS.length) {
        timer = setTimeout(() => setRetry({ key, attempt: attempt + 1 }), PHOTO_RETRY_DELAYS_MS[attempt]);
      }
    });
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
    // The link changes on every re-sign; only a new photo (key) or a new try needs a new file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  if (!uri) return null;
  if (!key) return uri;
  return file && file.key === key ? file.file : null;
}

/** Loads photos into the cache before a screen needs them, a few at a time. Failures are ignored. */
export async function prefetchPhotos(uris: (string | null | undefined)[], concurrency = 3): Promise<void> {
  const queue = uris.filter((u): u is string => typeof u === 'string' && photoCacheKey(u) !== null);
  const worker = async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) await cachedPhotoFile(next);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

/** Stores a photo the phone already has (its own upload) under its object key, so it is never downloaded. */
export async function rememberPhoto(localUri: string, key: string): Promise<void> {
  try {
    await Image.writeToCacheAsync(localUri, key);
  } catch {
    // Only a missed shortcut: the photo downloads when it is first shown.
  }
}

/** Caps the cache (iOS; Android's cache has its own limit). Call once at start. */
export function configurePhotoCache(): void {
  if (Platform.OS === 'ios') Image.configureCache({ maxDiskSize: PHOTO_CACHE_MAX_BYTES });
}

/** Empties the cache (sign out), so the next account on this phone never sees the last one's photos. */
export async function forgetPhotos(): Promise<void> {
  await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]).catch(() => undefined);
}
