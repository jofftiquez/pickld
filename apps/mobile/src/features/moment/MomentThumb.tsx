import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import type { Edits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';

import { MomentCover } from './MomentCover';
import { hasVisibleEdits } from './momentRender';
import { photoCacheKey, photoSource } from '@/lib/image/photoCache';
import { photoPlaceholder } from '@/lib/image/photoPlaceholders';
import { usePhotoRetry } from '@/lib/image/usePhotoRetry';

export type MomentThumbProps = {
  uri: string | null;
  /** The moment's edits; left out (or plain) draws the plain thumbnail. */
  edits?: Edits | null;
  stamp?: StampMoment | null;
  /** expo-image's recycling key, for lists. */
  recyclingKey?: string;
  transition?: number;
  testID?: string;
};

/**
 * A moment's photo filling its parent like `contentFit="cover"` (D-96): drawn with its stickers, text and
 * filter (`MomentCover`) when it has visible edits, else the plain thumbnail. Decorative: the parent speaks.
 */
export function MomentThumb({ uri, edits, stamp = null, recyclingKey, transition, testID }: MomentThumbProps) {
  const retry = usePhotoRetry(uri === null ? null : (photoCacheKey(uri) ?? uri));
  if (uri === null) return null;
  if (edits && hasVisibleEdits(edits)) {
    return <MomentCover uri={uri} edits={edits} stamp={stamp} accessible={false} testID={testID} />;
  }
  return (
    <Image
      key={retry.attempt}
      source={photoSource(uri)}
      onError={retry.onError}
      placeholder={photoPlaceholder(uri)}
      placeholderContentFit="cover"
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      recyclingKey={recyclingKey}
      transition={transition}
      accessible={false}
      testID={testID ? `${testID}-plain` : undefined}
    />
  );
}
