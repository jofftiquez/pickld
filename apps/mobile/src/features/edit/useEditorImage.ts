import { Skia, type SkImage } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';

import { FULL_SIZE } from '@/lib/image/crop';
import { captureError } from '@/lib/monitoring';

async function decode(uri: string): Promise<SkImage | null> {
  return Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
}

/** A JPEG copy of the photo, at most the full photo's width, in the cache. */
async function jpegCopy(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  try {
    const rendered = await context.resize({ width: FULL_SIZE.width }).renderAsync();
    try {
      return (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 })).uri;
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}

/**
 * The photo at `uri` decoded for the editor's canvas. Skia has no HEIC decoder, and HEIC is what Photos hands
 * over for an iPhone photo (an exactly 3:4 one skips Crop, so the editor opens on the raw file before it is
 * prepared): such a photo is decoded from a JPEG copy, deleted once read.
 */
export async function loadEditorImage(uri: string): Promise<SkImage | null> {
  const image = await decode(uri);
  if (image) return image;
  const copy = await jpegCopy(uri);
  try {
    return await decode(copy);
  } finally {
    try {
      new File(copy).delete();
    } catch {
      // A leftover cache file wastes space but loses nothing.
    }
  }
}

/**
 * The editor's photo (D-155): always the newest `uri`. A load for an older `uri` that ends late (the raw file
 * a queued photo opened on, swapped for the prepared one) never replaces a newer photo, and a load that fails
 * (the raw file deleted mid-read) keeps the last photo drawn instead of a blank canvas.
 */
export function useEditorImage(uri: string | null): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);
  useEffect(() => {
    if (!uri) return;
    let live = true;
    loadEditorImage(uri).then(
      (loaded) => {
        if (live && loaded) setImage(loaded);
      },
      (error: unknown) => {
        if (live) captureError(error, { area: 'edit' });
      },
    );
    return () => {
      live = false;
    };
  }, [uri]);
  return image;
}
