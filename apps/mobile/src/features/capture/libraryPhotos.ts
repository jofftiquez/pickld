// The phone's photo library for the in-app gallery grid (FR-CAP-02). iOS only, and only with the Photos
// access the user already gave during setup: this never asks for it. Without it (or on Android) the camera
// keeps the system picker, which needs no access.
import { File, Paths } from 'expo-file-system';
import {
  addListener,
  Asset,
  AssetField,
  getPermissionsAsync,
  MediaType,
  presentPermissionsPicker,
  Query,
} from 'expo-media-library';
import { Platform } from 'react-native';

import { exifFromCreationTime, type LibraryPhoto } from './galleryDays';
import type { PickedPhoto } from './pickFromGallery';

export type LibraryAccess = 'all' | 'limited';

/** The Photos access Pickld has now: all photos, the ones the user chose (limited), or none (null). */
export async function libraryAccess(): Promise<LibraryAccess | null> {
  if (Platform.OS !== 'ios') return null;
  const permission = await getPermissionsAsync(false, ['photo']);
  if (!permission.granted) return null;
  return permission.accessPrivileges === 'limited' ? 'limited' : 'all';
}

/** A page of the library's photos, newest first. */
export async function loadLibraryPhotos(offset: number, limit: number): Promise<LibraryPhoto[]> {
  const rows = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .offset(offset)
    .limit(limit)
    .exeForMetadata();
  return rows.map((row) => ({
    id: row.id,
    width: row.width ?? 0,
    height: row.height ?? 0,
    creationTime: row.creationTime,
  }));
}

/** Calls `listener` when the library changes, e.g. after Choose more. Returns the unsubscribe. */
export function onLibraryChange(listener: () => void): () => void {
  const subscription = addListener(listener);
  return () => subscription.remove();
}

/** With limited access, lets the user share more photos with Pickld (Apple's own sheet). */
export function chooseMorePhotos(): Promise<void> {
  return presentPermissionsPicker(['photo']);
}

/**
 * The chosen photo as a full-size file Pickld owns, for Crop and the queue: Photos' full-size image (with the
 * user's edits; downloaded from iCloud when needed) copied into the cache, never a `ph://` thumbnail. The
 * size is the photo's pixel size as shown, and the EXIF-style time comes from its date in Photos, the same
 * date the grid shows. Location never leaves the phone: the queue re-encodes without metadata (rule 5).
 */
export async function libraryPhotoFile(photo: LibraryPhoto, tz: string): Promise<PickedPhoto> {
  const source = new File(await new Asset(photo.id).getUri());
  const copy = new File(Paths.cache, `gallery-${Date.now()}${source.extension}`);
  await source.copy(copy);
  return {
    uri: copy.uri,
    width: photo.width,
    height: photo.height,
    exif: photo.creationTime === null ? null : exifFromCreationTime(photo.creationTime, tz),
  };
}
