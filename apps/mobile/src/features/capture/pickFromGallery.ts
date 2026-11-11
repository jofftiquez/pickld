import * as ImagePicker from 'expo-image-picker';

/** A photo chosen from the gallery: its local file, pixel size and EXIF (for its capture time). */
export type PickedPhoto = { uri: string; width: number; height: number; exif: unknown };

/**
 * Lets the user choose one photo from the gallery (FR-CAP-02, D-26). Resolves with it, or `null` when they
 * cancel. Images only, one at a time, no editing UI from the system (the Crop screen does that). EXIF is
 * requested only for the capture time (`captureInfo`); location never leaves the phone, because the image
 * pipeline re-encodes the photo without metadata before upload (rule 5). On iOS the photo is converted to
 * a widely readable format (HEIC → JPEG). The system picker needs no photo library permission.
 */
export async function pickFromGallery(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: false,
    allowsMultipleSelection: false,
    selectionLimit: 1,
    exif: true,
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height, exif: asset.exif ?? null };
}
