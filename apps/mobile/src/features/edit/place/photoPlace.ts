import { createContext, useContext } from 'react';
import { z } from 'zod';

// Where a picked or shared photo was taken, from its own metadata, so the Place tool can offer "Use the
// photo's location". Read before the queue re-encodes the photo without location (rule 5) and kept only in
// this module's memory, by queue id: never in the queue's SQLite row, the server or analytics. It is gone
// once the moment is added or discarded, or the app restarts. Only the town name the user chooses to put on
// a sticker is ever saved.

export type Coords = { latitude: number; longitude: number };

// The image picker's EXIF (iOS copies {GPS} to GPS<tag>, with N/S and E/W refs; Android gives signed
// values), and the same keys from Photos (libraryPhotos.ts) and the share extension (sharedPhoto.ts).
const gpsSchema = z.object({
  GPSLatitude: z.number().finite(),
  GPSLongitude: z.number().finite(),
  GPSLatitudeRef: z.string().optional(),
  GPSLongitudeRef: z.string().optional(),
});

const signed = (value: number, ref: string | undefined, negative: string) =>
  ref === undefined ? value : Math.abs(value) * (ref.trim().toUpperCase().startsWith(negative) ? -1 : 1);

/** The coordinates in a photo's EXIF, or null when it has none (or only the 0, 0 a broken GPS writes). */
export function photoCoords(exif: unknown): Coords | null {
  const gps = gpsSchema.safeParse(exif);
  if (!gps.success) return null;
  const latitude = signed(gps.data.GPSLatitude, gps.data.GPSLatitudeRef, 'S');
  const longitude = signed(gps.data.GPSLongitude, gps.data.GPSLongitudeRef, 'W');
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

const remembered = new Map<number, Coords>();

/** Keeps a queued photo's coordinates in memory for its editor, when its EXIF has them. */
export function rememberPhotoPlace(queueId: number, exif: unknown): void {
  const coords = photoCoords(exif);
  if (coords) remembered.set(queueId, coords);
}

export function photoPlaceFor(queueId: number): Coords | null {
  return remembered.get(queueId) ?? null;
}

export function forgetPhotoPlace(queueId: number): void {
  remembered.delete(queueId);
}

const PhotoPlaceContext = createContext<Coords | null>(null);

/** Gives the Place tool the edited photo's coordinates (the queued editor provides them, when known). */
export const PhotoPlaceProvider = PhotoPlaceContext.Provider;

export function usePhotoPlace(): Coords | null {
  return useContext(PhotoPlaceContext);
}
