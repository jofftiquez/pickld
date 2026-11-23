// The moment renderer's pure parts (M2-18): what a moment's picture says to screen readers, whether its
// edits change the plain photo, and how a 3:4 moment fills a frame of another shape.
import type { TFunction } from 'i18next';

import type { Edits } from '@/features/edit/edits';
import { photo } from '@/theme/tokens';

/** True when the edits draw anything over the plain photo: a color filter or an overlay. */
export function hasVisibleEdits(edits: Edits): boolean {
  return edits.filter !== 'original' || edits.overlays.length > 0;
}

/**
 * One spoken label for the whole picture, e.g. "Photo with 2 stickers and text". It counts the overlay
 * kinds and never includes what a bubble, text or place says, who a mention tags, nor the caption. MomentView
 * adds the photo description with describedLabel.
 */
export function momentLabel(edits: Edits, t: TFunction): string {
  const count = (type: Edits['overlays'][number]['type']) => edits.overlays.filter((o) => o.type === type).length;
  const parts = [
    { key: 'momentRenderer.stickers' as const, count: count('sticker') },
    { key: 'momentRenderer.bubbles' as const, count: count('bubble') },
    { key: 'momentRenderer.texts' as const, count: count('text') },
    { key: 'momentRenderer.places' as const, count: count('place') },
    { key: 'momentRenderer.mentions' as const, count: count('mention') },
  ]
    .filter((part) => part.count > 0)
    .map((part) => t(part.key, { count: part.count }));
  if (parts.length === 0) return t('momentRenderer.photo');
  const [a = '', b = '', c = '', d = '', e = ''] = parts;
  const items =
    parts.length === 1
      ? a
      : parts.length === 2
        ? t('momentRenderer.list2', { a, b })
        : parts.length === 3
          ? t('momentRenderer.list3', { a, b, c })
          : parts.length === 4
            ? t('momentRenderer.list4', { a, b, c, d })
            : t('momentRenderer.list5', { a, b, c, d, e });
  return t('momentRenderer.photoWith', { items });
}

/**
 * `label` followed by the owner's photo description (0174), when the moment has one: "#ootd: A blue dress on
 * a rooftop". The description is the owner's own words, but it is shown only with the photo it describes, to
 * people who can see that photo; never send it to analytics (rule 10).
 */
export function describedLabel(label: string, edits: Edits, t: TFunction): string {
  return edits.alt ? t('momentRenderer.described', { label, description: edits.alt }) : label;
}

/** Where a moment drawn at `width` (and 4:3 of it tall) sits in its frame. */
export type CoverBox = { width: number; left: number; top: number };

/**
 * The moment scaled to cover a `frame` of any shape and centred, like `contentFit="cover"` on the plain
 * photo: a wide Today tile shows the middle band of the 3:4 picture, overlays included.
 */
export function coverBox(frame: { width: number; height: number }): CoverBox {
  const width = Math.max(frame.width, frame.height * photo.aspect);
  const height = width / photo.aspect;
  return { width, left: (frame.width - width) / 2, top: (frame.height - height) / 2 };
}
