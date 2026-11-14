import { useImage } from '@shopify/react-native-skia';

import { FilteredPhoto } from '@/features/edit/FilteredPhoto';
import { filterMatrices, type FilterId } from '@/features/edit/filters';
import { useCachedPhotoFile } from '@/lib/image/photoCache';

export type FilteredMomentPhotoProps = {
  /** Remote (signed) or local file URI of the photo. */
  uri: string;
  filter: FilterId;
  width: number;
  height: number;
};

/**
 * A moment's photo decoded by Skia and drawn with its color filter (the editor's own canvas). Skia has no
 * cache of its own, so it reads the photo cache's file (downloaded into it first when needed).
 */
export function FilteredMomentPhoto({ uri, filter, width, height }: FilteredMomentPhotoProps) {
  const image = useImage(useCachedPhotoFile(uri) ?? undefined);
  return (
    <FilteredPhoto
      image={image}
      matrix={filterMatrices[filter]}
      width={width}
      height={height}
      testID="moment-view-filtered"
    />
  );
}
