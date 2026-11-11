import type { TFunction } from 'i18next';
import type { ComponentType } from 'react';

import type { Overlay } from '../edits';

export type OverlayType = Overlay['type'];

export type OverlayContentProps<T extends OverlayType = OverlayType> = {
  overlay: Extract<Overlay, { type: T }>;
  /** The overlay's box on the photo, in points. Content fills it; it is drawn rotated and on top. */
  width: number;
  height: number;
};

/** How one kind of overlay draws itself; the transform engine handles position, size and gestures. */
export type OverlayRenderer<T extends OverlayType = OverlayType> = {
  /** Height ÷ width of the overlay's box. */
  aspect: (overlay: Extract<Overlay, { type: T }>) => number;
  Content: ComponentType<OverlayContentProps<T>>;
  /** What VoiceOver and TalkBack call it, e.g. the sticker's name or the bubble's text. */
  accessibilityLabel: (overlay: Extract<Overlay, { type: T }>, t: TFunction) => string;
};

const renderers = new Map<OverlayType, OverlayRenderer>();

/**
 * Registers how a kind of overlay draws (M2-15 stickers, M2-16 bubbles, M2-17 text). Registering again
 * replaces the earlier renderer.
 */
export function registerOverlayRenderer<T extends OverlayType>(type: T, renderer: OverlayRenderer<T>): void {
  // Stored by its type and only ever handed overlays of that type (see getOverlayRenderer).
  renderers.set(type, renderer as unknown as OverlayRenderer);
}

/** The renderer for an overlay's kind. Overlays of a kind with no renderer are not drawn. */
export function getOverlayRenderer(type: OverlayType): OverlayRenderer | undefined {
  return renderers.get(type);
}

/** Removes a renderer (tests). */
export function unregisterOverlayRenderer(type: OverlayType): void {
  renderers.delete(type);
}
