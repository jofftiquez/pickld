// Straighten (FR-CAP-03): the levelled photo's crop, drawn at its output size. expo-image-manipulator turns only
// by whole canvases (with empty corners that differ by platform), so the tilt is drawn with Skia on the CPU, like
// Fit's frame (fitFrame.ts), and written as a lossless PNG that the pipeline encodes like any other output.
import { FilterMode, ImageFormat, MipmapMode, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { levelledSize, type CropRect, type Size } from './crop';

/**
 * Draws `rect` of the photo at `photoUri` (already turned and mirrored) tilted `degrees` clockwise about its
 * centre, where `rect` is in the levelled photo's pixels (`levelledSize`, centred on the photo), scaled to fill
 * `out`. Returns the PNG file's URI in the cache.
 */
export async function drawStraightened(photoUri: string, degrees: number, rect: CropRect, out: Size): Promise<string> {
  const photo = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(await new File(photoUri).bytes()));
  if (!photo) throw new Error('Straighten: photo could not be decoded');
  const surface = Skia.Surface.Make(out.width, out.height);
  if (!surface) {
    photo.dispose();
    throw new Error('Straighten: no surface');
  }
  try {
    const turned = { width: photo.width(), height: photo.height() };
    const level = levelledSize(turned, degrees);
    const canvas = surface.getCanvas();
    // Read right to left: the photo's centre to the origin, tilted, the rectangle's centre (from the levelled
    // photo's centre) to the origin, scaled to the output, then to the output's centre.
    canvas.translate(out.width / 2, out.height / 2);
    canvas.scale(out.width / rect.width, out.height / rect.height);
    canvas.translate(
      -(rect.originX + rect.width / 2 - level.width / 2),
      -(rect.originY + rect.height / 2 - level.height / 2),
    );
    canvas.rotate(degrees, 0, 0);
    canvas.translate(-turned.width / 2, -turned.height / 2);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const whole = Skia.XYWHRect(0, 0, turned.width, turned.height);
    canvas.drawImageRectOptions(photo, whole, whole, FilterMode.Linear, MipmapMode.Linear, paint);
    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
    const file = new File(Paths.cache, `level-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    file.create();
    file.write(bytes);
    return file.uri;
  } finally {
    surface.dispose();
    photo.dispose();
  }
}
