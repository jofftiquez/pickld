import { place } from '@/theme/tokens';

import type { Mention } from '../edits';
import { TEXT_REF_WIDTH } from '../text/textOverlay';

// A mention pill is the Place sticker's pill (tokens.place) without the pin: "@username" on one line.

/** What a mention sticker says. */
export function mentionText(username: string): string {
  return `@${username}`;
}

/** A mention pill's width in reference points: room for "@username" on one line. */
export function mentionReferenceWidth(username: string): number {
  const chars = Array.from(mentionText(username)).length;
  return Math.ceil(2 * place.paddingX + chars * place.fontSize * place.charWidth);
}

/** Height ÷ width of a mention pill's box. */
export function mentionAspect(overlay: Pick<Mention, 'username'>): number {
  return place.referenceHeight / mentionReferenceWidth(overlay.username);
}

/** A new pill's width, as a fraction of the photo, so its text reads at the design's size. */
export function newMentionScale(username: string): number {
  return Math.min(0.95, mentionReferenceWidth(username) / TEXT_REF_WIDTH);
}

/** The width a pill takes when it names someone else, so the letters keep their size. */
export function rescaleMention(overlay: Pick<Mention, 'username' | 'scale'>, username: string): number {
  return Math.min(4, (overlay.scale * mentionReferenceWidth(username)) / mentionReferenceWidth(overlay.username));
}
