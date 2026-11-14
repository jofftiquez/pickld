import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Edits } from '@/features/edit/edits';
import { registerOverlayRenderers } from '@/features/edit/overlays/registerRenderers';
import { getOverlayRenderer, useAspectRevision } from '@/features/edit/overlays/registry';
import { toPixels } from '@/features/edit/overlays/transform';
import { StampMomentProvider, type StampMoment } from '@/features/edit/stickers/stamps';
import { colors, photo } from '@/theme/tokens';

import { FilteredMomentPhoto } from './FilteredMomentPhoto';
import { momentLabel } from './momentRender';
import { photoCacheKey, photoSource } from '@/lib/image/photoCache';
import { photoPlaceholder } from '@/lib/image/photoPlaceholders';
import { usePhotoRetry } from '@/lib/image/usePhotoRetry';

// The same renderers the editor draws with, so a moment looks the way its owner left it.
registerOverlayRenderers();

export type MomentViewProps = {
  /** The photo (remote signed URL or queued local file); null shows the placeholder color. */
  uri: string | null;
  /** Parsed with `parseEdits`, so old or bad stored edits arrive as the plain photo. */
  edits: Edits;
  /** Width in points (or pixels for a share card); the height is 4:3 of it. */
  width: number;
  /** What auto stamps show (capture time in the jar's zone, jar number). Without it they show their art. */
  stamp?: StampMoment | null;
  /** False when the view sits inside a control that already speaks for it (a Today tile). */
  accessible?: boolean;
  testID?: string;
};

/**
 * A moment as its owner made it (FR-CAP-08): the photo, its color filter and its overlays drawn from
 * `edits`, read-only, at any size (tiles, the moment detail, the share card). Every overlay is placed
 * and sized as a fraction of the width and laid out at its own reference width, so the picture is the
 * same at every size, only scaled. Stickers draw by asset path from the art bundled with the app, or art
 * downloaded from the photo Worker (D-131), so a viewer sees them without owning the pack (FR-STK-04). No gestures, selection or touch targets: the
 * whole view is one image for screen readers, labelled without any of the user's words. Overlays appear only
 * once the photo is drawn: over the grey box or the blurred placeholder they would look like they float.
 */
export function MomentView({ uri, edits, width, stamp = null, accessible = true, testID }: MomentViewProps) {
  const { t } = useTranslation();
  useAspectRevision();
  const size = { width, height: width / photo.aspect };
  const placeholder = photoPlaceholder(uri);
  // A re-signed link is the same photo: it keeps its overlays and its count of tries.
  const photoId = uri === null ? null : (photoCacheKey(uri) ?? uri);
  const [drawnId, setDrawnId] = useState<string | null>(null);
  const drawn = photoId !== null && drawnId === photoId;
  const onDrawn = useCallback(() => setDrawnId(photoId), [photoId]);
  const retry = usePhotoRetry(photoId);
  const placed = edits.overlays.flatMap((overlay) => {
    const renderer = getOverlayRenderer(overlay.type);
    return renderer ? [{ overlay, renderer, box: toPixels(overlay, size, renderer.aspect(overlay)) }] : [];
  });

  return (
    <View
      style={[styles.frame, size]}
      pointerEvents="none"
      accessible={accessible}
      accessibilityRole={accessible ? 'image' : undefined}
      accessibilityLabel={accessible ? momentLabel(edits, t) : undefined}
      accessibilityElementsHidden={!accessible}
      importantForAccessibility={accessible ? 'yes' : 'no-hide-descendants'}
      testID={testID}
    >
      {uri === null ? null : edits.filter === 'original' ? (
        <Image
          key={retry.attempt}
          source={photoSource(uri)}
          onLoad={onDrawn}
          onError={retry.onError}
          placeholder={placeholder}
          placeholderContentFit="cover"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessible={false}
          testID="moment-view-photo"
        />
      ) : (
        <>
          {/* Skia draws nothing until the photo file is ready; the blurred placeholder shows through until then. */}
          {placeholder ? (
            <Image
              source={placeholder}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
              testID="moment-view-placeholder"
            />
          ) : null}
          <FilteredMomentPhoto
            uri={uri}
            filter={edits.filter}
            width={size.width}
            height={size.height}
            onReady={onDrawn}
          />
        </>
      )}
      <StampMomentProvider value={stamp}>
        {/* Mounted while hidden, so sticker art loads alongside the photo. */}
        <View style={[StyleSheet.absoluteFill, !drawn && styles.hidden]} testID="moment-overlays">
          {placed.map(({ overlay, renderer: { Content }, box }) => (
            <View
              key={overlay.id}
              style={[
                styles.overlay,
                {
                  left: box.cx - box.width / 2,
                  top: box.cy - box.height / 2,
                  width: box.width,
                  height: box.height,
                  transform: [{ rotate: `${box.rotation}rad` }],
                },
              ]}
              testID={`moment-overlay-${overlay.id}`}
            >
              <Content overlay={overlay} width={box.width} height={box.height} />
            </View>
          ))}
        </View>
      </StampMomentProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.photoPlaceholder },
  overlay: { position: 'absolute' },
  hidden: { opacity: 0 },
});
