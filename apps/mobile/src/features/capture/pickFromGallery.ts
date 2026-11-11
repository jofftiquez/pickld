/**
 * Lets the user choose one photo from the gallery (FR-CAP-02). Resolves with its local URI, or `null`
 * when they cancel.
 *
 * TODO(M2-08 gallery, awaiting expo-image-picker approval): implement with expo-image-picker (any
 * gallery photo; non-3:4 photos then open Crop). Until then it always throws, and callers report it.
 */
export async function pickFromGallery(): Promise<string | null> {
  throw new Error('gallery picker not installed');
}
