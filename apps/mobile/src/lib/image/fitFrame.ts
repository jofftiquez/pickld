// Fit's framed photo (D-152, D-154; FR-CAP-03): the whole photo inside the 3:4 frame where the Crop screen
// placed it, with its optional plain border and rounded corners, the space around it filled with a plain colour
// or a soft blur of the photo. expo-image-manipulator can't pad or blur on iOS, so the frame is
// drawn with Skia on the CPU and written as a lossless PNG, which the pipeline then encodes as the WebP
// full photo and thumbnail like any other (and checks for location metadata).
import { ClipOp, FilterMode, ImageFormat, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { crop as cropTokens, fitBorderColors, fitFrameColors } from '@/theme/tokens';

import { cropRect34, type FitPixels, type FitStyle, type Size } from './crop';

/**
 * Draws the photo at `photoUri` (already `place.photo`'s size: no scaling, so it stays as sharp as the source)
 * on an `out`-sized frame filled with `style.frame`, and returns the PNG file's URI in the cache. `blur` fills the
 * frame with the photo itself, cropped to cover it and blurred (sigma `crop.fitBlur` of the frame's width), so
 * nothing outside the photo is invented. A border (D-154) is a rounded rectangle of `style.borderColor` under the
 * photo, `place.border` wide on every side; the photo is clipped to the corners inside it
 * (`place.radius − place.border`), so the border is even all round.
 */
export async function composeFit(
  photoUri: string,
  place: FitPixels,
  style: Pick<FitStyle, 'frame' | 'borderColor'>,
  out: Size,
): Promise<string> {
  const { frame } = style;
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
    const { box, photo: at, border, radius } = place;
    if (border > 0) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color(fitBorderColors[style.borderColor]));
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(box.originX, box.originY, box.width, box.height), radius, radius),
        paint,
      );
    }
    const inner = Math.max(0, radius - border);
    if (inner > 0) {
      canvas.save();
      canvas.clipRRect(
        Skia.RRectXY(Skia.XYWHRect(at.originX, at.originY, at.width, at.height), inner, inner),
        ClipOp.Intersect,
        true,
      );
      canvas.drawImage(photo, at.originX, at.originY);
      canvas.restore();
    } else {
      canvas.drawImage(photo, at.originX, at.originY);
    }
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
