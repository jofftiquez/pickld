// Centre snapping for things dragged over a photo (D-158): Crop's Fit photo, and the editor's stickers, text and
// bubbles. Pure worklets with no hidden state, so they run in a pan gesture on either thread.
//
// Usage: on every pan update, work out the dragged thing's centre as its distance from the photo's centre in
// display points (so `sizes.snapThreshold` means the same on screen at any photo size), call `snapCenter` (or
// `snapAxis` for one axis) with the snapped flags it returned last time (all false when the drag starts), and
// keep the flags it returns for the next update. Place the thing at the returned value (0 when snapped: exactly
// centred), then clamp it as usual. Show `SnapGuides` for the snapped axes, and fire `selectionHaptic()` (through
// `scheduleOnRN` / `runOnJS` from a worklet) only when an axis goes from not snapped to snapped, never on release.
//
// Hysteresis: an axis snaps in within `threshold` of the centre and lets go only beyond `threshold` × 1.5, so a
// finger resting near the edge of the zone doesn't make the guide flicker.

/** How far past the snap-in threshold a snapped axis must be dragged before it lets go. */
const RELEASE = 1.5;

/**
 * One axis. `offset` is the distance from the centre in display points; `wasSnapped` what this returned last
 * time. Snapped: `value` is 0. Not snapped: `value` is `offset`, unchanged.
 */
export function snapAxis(offset: number, threshold: number, wasSnapped: boolean): { value: number; snapped: boolean } {
  'worklet';
  const zone = wasSnapped ? threshold * RELEASE : threshold;
  return Math.abs(offset) <= zone ? { value: 0, snapped: true } : { value: offset, snapped: false };
}

/** Both axes: `p` is the centre's offset from the photo's centre in display points; `was` the last flags. */
export function snapCenter(
  p: { x: number; y: number },
  threshold: number,
  was: { x: boolean; y: boolean },
): { x: number; y: number; snappedX: boolean; snappedY: boolean } {
  'worklet';
  const x = snapAxis(p.x, threshold, was.x);
  const y = snapAxis(p.y, threshold, was.y);
  return { x: x.value, y: y.value, snappedX: x.snapped, snappedY: y.snapped };
}
