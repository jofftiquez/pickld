import { deleteCenter, handleCenter, hitTest, type Placed } from '../overlays/hitTest';

// What a touch on the overlay layer lands on (FR-CAP-05). Sizes from tokens: delete circle 24 poking out
// 14 (centre 2 past the corner), handle 18 poking out 12 (centre 3 past the corner), 44-point targets.

const box = (cx: number, cy: number, rotation = 0) => ({ cx, cy, width: 100, height: 40, rotation });

describe('control positions', () => {
  it('puts the delete circle past the top-right corner and the handle past the bottom-right one', () => {
    expect(deleteCenter(box(0, 0))).toEqual({ x: 52, y: -22 });
    expect(handleCenter(box(0, 0))).toEqual({ x: 53, y: 23 });
  });
});

describe('hitTest', () => {
  const below: Placed = { id: 'below', box: box(100, 100) };
  const above: Placed = { id: 'above', box: box(130, 100) };
  const placed = [below, above];

  it('finds the topmost overlay under the touch', () => {
    expect(hitTest(placed, null, { x: 120, y: 100 })).toEqual({ id: 'above', part: 'body' });
    expect(hitTest(placed, null, { x: 60, y: 100 })).toEqual({ id: 'below', part: 'body' });
    expect(hitTest(placed, null, { x: 300, y: 300 })).toBeNull();
  });

  it("finds the selected overlay's delete circle and handle before any overlay", () => {
    // below's delete circle centre is (152, 78), inside above's body.
    expect(hitTest(placed, 'below', { x: 152, y: 78 })).toEqual({ id: 'below', part: 'delete' });
    expect(hitTest(placed, 'below', { x: 153, y: 123 })).toEqual({ id: 'below', part: 'handle' });
    // 22 points out is still on it; 23 is not.
    expect(hitTest(placed, 'below', { x: 152 + 22, y: 78 })).toEqual({ id: 'below', part: 'delete' });
    expect(hitTest(placed, 'below', { x: 152 + 23, y: 78 })).toEqual({ id: 'above', part: 'body' });
  });

  it('gives controls only to the selected overlay', () => {
    expect(hitTest(placed, null, { x: 152, y: 78 })).toEqual({ id: 'above', part: 'body' });
    expect(hitTest([below], null, { x: 152, y: 60 })).toBeNull();
  });

  it('follows the overlay when it is rotated', () => {
    // A half turn carries the top-right delete circle to the bottom-left: (100 - 52, 100 + 22).
    const flipped: Placed = { id: 'f', box: box(100, 100, Math.PI) };
    expect(hitTest([flipped], 'f', { x: 48, y: 122 })).toEqual({ id: 'f', part: 'delete' });
    expect(hitTest([flipped], 'f', { x: 152, y: 78 })).toBeNull();
  });
});
