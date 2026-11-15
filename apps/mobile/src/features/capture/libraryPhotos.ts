// The phone's photo library for the in-app gallery grid (FR-CAP-02). iOS only. The camera's gallery button
// uses Photos access only when it was already given and never asks; filling a past day (the day page, D-153)
// asks once with Apple's prompt while access was never decided (`askLibraryAccess`). Without access (or on
// Android) the system picker opens instead, which needs none.
import { File, Paths } from 'expo-file-system';
import {
  addListener,
  Asset,
  AssetField,
  getPermissionsAsync,
  MediaType,
  presentPermissionsPicker,
  Query,
  requestPermissionsAsync,
  type PermissionResponse,
} from 'expo-media-library';
import { Platform } from 'react-native';

import { exifFromCreationTime, type DayRange, type LibraryPhoto } from './galleryDays';
import type { PickedPhoto } from './pickFromGallery';

export type LibraryAccess = 'all' | 'limited';

/** The Photos access Pickld has now: all photos, the ones the user chose (limited), or none (null). */
export async function libraryAccess(): Promise<LibraryAccess | null> {
  if (Platform.OS !== 'ios') return null;
  return accessOf(await getPermissionsAsync(false, ['photo']));
}

/**
 * Like `libraryAccess`, but while Photos access was never decided it first asks once with Apple's prompt
 * (photos only). Once decided (granted, limited or denied) it never asks again.
 */
export async function askLibraryAccess(): Promise<LibraryAccess | null> {
  if (Platform.OS !== 'ios') return null;
  const permission = await getPermissionsAsync(false, ['photo']);
  if (permission.status !== 'undetermined') return accessOf(permission);
  return accessOf(await requestPermissionsAsync(false, ['photo']));
}

function accessOf(permission: PermissionResponse): LibraryAccess | null {
  if (!permission.granted) return null;
  return permission.accessPrivileges === 'limited' ? 'limited' : 'all';
}

/** A page of the library's photos, newest first; with `range`, only the ones taken within it. */
export async function loadLibraryPhotos(
  offset: number,
  limit: number,
  range: DayRange | null = null,
): Promise<LibraryPhoto[]> {
  let query = new Query().eq(AssetField.MEDIA_TYPE, MediaType.IMAGE);
  if (range !== null) query = query.gte(AssetField.CREATION_TIME, range.from).lt(AssetField.CREATION_TIME, range.to);
  const rows = await query
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
