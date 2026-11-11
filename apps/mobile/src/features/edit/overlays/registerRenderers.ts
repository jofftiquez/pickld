import { registerBubbleRenderer } from '../bubble/BubbleOverlay';
import { registerStickerRenderer } from '../stickers/stickerRenderer';
import { registerTextRenderer } from '../text/registerTextRenderer';

/**
 * Registers how every overlay kind draws: stickers (M2-15), bubbles (M2-16) and text (M2-17). The
 * editor and the moment renderer (M2-18) both call it, so they draw overlays the same way. Calling it
 * again just registers the same renderers again.
 */
export function registerOverlayRenderers(): void {
  registerStickerRenderer();
  registerBubbleRenderer();
  registerTextRenderer();
}
