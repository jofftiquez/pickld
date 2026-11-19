import { place } from '@/theme/tokens';

import type { Place } from '../edits';
import { TEXT_REF_WIDTH } from '../text/textOverlay';

/** The pin, on a 24-point square: a round head over a point, its dot a hole (fill it even-odd). */
export const PIN_PATH =
  'M12 1.5C7.86 1.5 4.5 4.8 4.5 8.9c0 5.4 7.5 13.6 7.5 13.6s7.5-8.2 7.5-13.6C19.5 4.8 16.14 1.5 12 1.5Zm0 4.4a3 3 0 1 1 0 6a3 3 0 0 1 0-6Z';
export const PIN_VIEWBOX = 24;

/** A place pill's width in reference points: the pin, the gap and room for its text on one line. */
export function placeReferenceWidth(text: string): number {
  const chars = Math.max(1, Array.from(text.trim()).length);
  return Math.ceil(2 * place.paddingX + place.icon + place.gap + chars * place.fontSize * place.charWidth);
}

/** Height ÷ width of a place pill's box. */
export function placeAspect(overlay: Pick<Place, 'text'>): number {
  return place.referenceHeight / placeReferenceWidth(overlay.text);
}

/** A new pill's width, as a fraction of the photo, so its text reads at the design's size; never wider than the photo. */
export function newPlaceScale(text: string): number {
  return Math.min(0.95, placeReferenceWidth(text) / TEXT_REF_WIDTH);
}

/** The width a pill takes when its text changes, so the letters keep their size. */
export function rescalePlace(overlay: Pick<Place, 'text' | 'scale'>, text: string): number {
  return Math.min(4, (overlay.scale * placeReferenceWidth(text)) / placeReferenceWidth(overlay.text));
}
