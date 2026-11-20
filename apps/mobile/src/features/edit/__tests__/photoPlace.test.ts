import { forgetPhotoPlace, photoCoords, photoPlaceFor, rememberPhotoPlace } from '../place/photoPlace';

describe("a photo's own location", () => {
  it('reads iOS picker EXIF, applying the S and W refs to unsigned values', () => {
    expect(
      photoCoords({ GPSLatitude: 33.8688, GPSLatitudeRef: 'S', GPSLongitude: 151.2093, GPSLongitudeRef: 'E' }),
    ).toEqual({ latitude: -33.8688, longitude: 151.2093 });
    expect(
      photoCoords({ GPSLatitude: 40.7128, GPSLatitudeRef: 'N', GPSLongitude: 74.006, GPSLongitudeRef: 'W' }),
    ).toEqual({ latitude: 40.7128, longitude: -74.006 });
  });

  it('keeps already-signed values (Android, Photos) with or without refs, never flipping them twice', () => {
    expect(photoCoords({ GPSLatitude: -33.8688, GPSLongitude: 151.2093 })).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
    expect(
      photoCoords({ GPSLatitude: -33.8688, GPSLatitudeRef: 'S', GPSLongitude: -74, GPSLongitudeRef: 'W' }),
    ).toEqual({ latitude: -33.8688, longitude: -74 });
  });

  it('is null without coordinates, for a broken 0, 0 fix, or out of range', () => {
    expect(photoCoords(null)).toBeNull();
    expect(photoCoords({ DateTimeOriginal: '2026:11:08 19:30:00' })).toBeNull();
    expect(photoCoords({ GPSLatitude: undefined, GPSLongitude: undefined })).toBeNull();
    expect(photoCoords({ GPSLatitude: 0, GPSLongitude: 0 })).toBeNull();
    expect(photoCoords({ GPSLatitude: 91, GPSLongitude: 10 })).toBeNull();
  });

  it('is remembered by queue id only while needed', () => {
    rememberPhotoPlace(41, { GPSLatitude: 16.4, GPSLongitude: 120.6 });
    rememberPhotoPlace(42, { DateTimeOriginal: '2026:11:08 19:30:00' });
    expect(photoPlaceFor(41)).toEqual({ latitude: 16.4, longitude: 120.6 });
    expect(photoPlaceFor(42)).toBeNull();
    forgetPhotoPlace(41);
    expect(photoPlaceFor(41)).toBeNull();
  });
});
