import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

import { getOverlayRenderer, registerOverlayRenderer, type OverlayContentProps, type OverlayType } from './registry';

/** A plain tinted box filling the overlay's frame. Development and tests only; never shipped to users. */
export function PlaceholderOverlay({ overlay, width, height }: OverlayContentProps) {
  return <View style={[styles.box, { width, height }]} testID={`overlay-placeholder-${overlay.id}`} />;
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.overlayPlaceholder, borderRadius: radius.thumb },
});

const kinds: readonly OverlayType[] = ['sticker', 'bubble', 'text'];

/**
 * Draws every overlay kind that has no real renderer yet as a box with a 1 : 2 aspect, so the transform
 * engine can be tried before the sticker, bubble and text tools land (M2-15, M2-16, M2-17). Kinds that
 * already have a renderer keep it. Call only in development builds and tests.
 */
export function registerPlaceholderRenderers(): void {
  for (const type of kinds) {
    if (getOverlayRenderer(type)) continue;
    registerOverlayRenderer(type, {
      aspect: () => 0.5,
      Content: PlaceholderOverlay,
      accessibilityLabel: (_overlay, t) => t('editOverlay.placeholder', { type }),
    });
  }
}
