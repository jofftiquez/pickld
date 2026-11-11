import { sizes } from '@/theme/tokens';

import { hitsBox, hitsControl, type PixelBox, type Point } from './transform';

// What a touch on the overlay layer lands on. The whole layer has one set of gestures, so a small or
// rotated overlay, its delete circle and its corner handle are found by geometry, topmost first.

export type Placed = { id: string; box: PixelBox };
export type Hit = { id: string; part: 'delete' | 'handle' | 'body' };

/** The delete circle's centre in the overlay's own frame (top-right corner, poking out). */
export function deleteCenter(box: PixelBox): Point {
  const r = sizes.overlayDelete / 2;
  return { x: box.width / 2 + sizes.overlayDeleteOffset - r, y: -box.height / 2 - sizes.overlayDeleteOffset + r };
}

/** The resize-and-rotate handle's centre in the overlay's own frame (bottom-right corner). */
export function handleCenter(box: PixelBox): Point {
  const r = sizes.overlayHandle / 2;
  return { x: box.width / 2 + sizes.overlayHandleOffset - r, y: box.height / 2 + sizes.overlayHandleOffset - r };
}

/**
 * The selected overlay's delete circle and handle win (each a 44-point target), then the overlays from
 * the top of the stack (last drawn) down. Null when the touch misses everything.
 */
export function hitTest(placed: readonly Placed[], selectedId: string | null, p: Point): Hit | null {
  const radius = sizes.minTap / 2;
  const selected = placed.find((o) => o.id === selectedId);
  if (selected) {
    if (hitsControl(selected.box, deleteCenter(selected.box), p, radius)) return { id: selected.id, part: 'delete' };
    if (hitsControl(selected.box, handleCenter(selected.box), p, radius)) return { id: selected.id, part: 'handle' };
  }
  for (let i = placed.length - 1; i >= 0; i -= 1) {
    const o = placed[i];
    if (o && hitsBox(o.box, p, sizes.minTap)) return { id: o.id, part: 'body' };
  }
  return null;
}
