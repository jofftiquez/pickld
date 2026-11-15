// Fit's framed photo (D-152; FR-CAP-03): the whole photo inside the 3:4 frame, the space around it filled with
// a plain colour or a soft blur of the photo. expo-image-manipulator can't pad or blur on iOS, so the frame is
// drawn with Skia on the CPU and written as a lossless PNG, which the pipeline then encodes as the WebP
// full photo and thumbnail like any other (and checks for location metadata).
import { FilterMode, ImageFormat, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { crop as cropTokens, fitFrameColors } from '@/theme/tokens';

import { cropRect34, type CropRect, type FitFrame, type Size } from './crop';

/**
 * Draws the photo at `photoUri` (already `box`'s size: no scaling, so it stays as sharp as the source) at
 * `box` on an `out`-sized frame filled with `frame`, and returns the PNG file's URI in the cache.
 * `blur` fills the frame with the photo itself, cropped to cover it and blurred (sigma `crop.fitBlur` of the
 * frame's width), so nothing outside the photo is invented.
 */
export async function composeFit(photoUri: string, box: CropRect, frame: FitFrame, out: Size): Promise<string> {
  const photo = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(await new File(photoUri).bytes()));
  if (!photo) throw new Error('Fit: photo could not be decoded');
  const surface = Skia.Surface.Make(out.width, out.height);
  if (!surface) throw new Error('Fit: no surface');
  try {
    const canvas = surface.getCanvas();
    if (frame === 'blur') {
      const paint = Skia.Paint();
      const sigma = cropTokens.fitBlur * out.width;
      paint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null));
      const cover = cropRect34(photo.width(), photo.height());
      canvas.drawImageRectOptions(
        photo,
        Skia.XYWHRect(cover.originX, cover.originY, cover.width, cover.height),
        Skia.XYWHRect(0, 0, out.width, out.height),
        FilterMode.Linear,
        MipmapMode.None,
        paint,
      );
    } else {
      canvas.drawColor(Skia.Color(fitFrameColors[frame]));
    }
    canvas.drawImage(photo, box.originX, box.originY);
    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
    const file = new File(Paths.cache, `fit-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    file.create();
    file.write(bytes);
    return file.uri;
  } finally {
    surface.dispose();
    photo.dispose();
  }
}
