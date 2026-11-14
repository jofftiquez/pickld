import { registerOverlayRenderer, type OverlayContentProps } from '../overlays/registry';
import { stickerArtSize } from './remoteStickerArt';
import { StickerOverlay } from './StickerOverlay';

// The art is about 2.5 : 1; a sticker whose size isn't known yet (downloaded art, D-131) keeps that shape.
const FALLBACK_ASPECT = 0.4;

/** Registers the sticker overlay renderer (M2-15): the art's own aspect, its name for screen readers. */
export function registerStickerRenderer(): void {
  registerOverlayRenderer('sticker', {
    aspect: (overlay) => {
      const art = stickerArtSize(overlay.asset);
      return art ? art.height / art.width : FALLBACK_ASPECT;
    },
    Content: StickerOverlay,
    accessibilityLabel: (overlay, t) => t('editStickers.overlay', { label: overlay.label }),
  });
}

export type StickerOverlayProps = OverlayContentProps<'sticker'>;
