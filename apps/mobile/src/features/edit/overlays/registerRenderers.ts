import { registerBubbleRenderer } from '../bubble/BubbleOverlay';
import { registerPlaceRenderer } from '../place/PlaceOverlay';
import { registerStickerRenderer } from '../stickers/stickerRenderer';
import { registerTextRenderer } from '../text/registerTextRenderer';

/**
 * Registers how every overlay kind draws: stickers (M2-15), bubbles (M2-16), text (M2-17) and places. The
 * editor and the moment renderer (M2-18) both call it, so they draw overlays the same way. Calling it
 * again just registers the same renderers again.
 */
export function registerOverlayRenderers(): void {
  registerStickerRenderer();
  registerBubbleRenderer();
  registerTextRenderer();
  registerPlaceRenderer();
}
