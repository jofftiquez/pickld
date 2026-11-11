import { registerOverlayRenderer } from '../overlays/registry';
import { textAspect } from './textOverlay';
import { TextOverlayView } from './TextOverlayView';

/** Registers how text overlays draw (FR-CAP-07): the box from the text's layout, the words as their label. */
export function registerTextRenderer(): void {
  registerOverlayRenderer('text', {
    aspect: textAspect,
    Content: TextOverlayView,
    accessibilityLabel: (overlay, t) => t('editText.overlayLabel', { text: overlay.text }),
  });
}
