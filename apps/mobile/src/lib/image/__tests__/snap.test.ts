import { snapAxis, snapCenter } from '../snap';

// Centre snapping (D-158): snaps in within the threshold, lets go only past 1.5 × the threshold, either side.
const T = 6;

describe('snapAxis', () => {
  it('not snapped: snaps to 0 within the threshold, on both sides of the centre', () => {
    for (const offset of [0, 3, -3, 6, -6]) expect(snapAxis(offset, T, false)).toEqual({ value: 0, snapped: true });
  });

  it('not snapped: leaves the offset alone just past the threshold, even inside the release zone', () => {
    for (const offset of [6.01, -6.01, 8, -8, 9, -9, 40, -40]) {
      expect(snapAxis(offset, T, false)).toEqual({ value: offset, snapped: false });
    }
  });

  it('snapped: stays at 0 up to 1.5 × the threshold, on both sides', () => {
    for (const offset of [0, 6.5, -6.5, 8, -8, 9, -9]) {
      expect(snapAxis(offset, T, true)).toEqual({ value: 0, snapped: true });
    }
  });

  it('snapped: lets go past 1.5 × the threshold and hands back the offset', () => {
    for (const offset of [9.01, -9.01, 12, -12]) {
      expect(snapAxis(offset, T, true)).toEqual({ value: offset, snapped: false });
    }
  });

  it('a drag in and out: snaps at 6, holds to 9, lets go at 9.5; coming back snaps again only at 6', () => {
    let snapped = false;
    const seen = [12, 7, 6, 8, 9, 9.5, 7, 5].map((offset) => {
      const next = snapAxis(offset, T, snapped);
      snapped = next.snapped;
      return next.value;
    });
    expect(seen).toEqual([12, 7, 0, 0, 0, 9.5, 7, 0]);
  });
});

describe('snapCenter', () => {
  it('snaps each axis on its own, with its own hysteresis', () => {
    expect(snapCenter({ x: 4, y: -20 }, T, { x: false, y: false })).toEqual({
      x: 0,
      y: -20,
      snappedX: true,
      snappedY: false,
    });
    expect(snapCenter({ x: -8, y: 8 }, T, { x: true, y: false })).toEqual({
      x: 0,
      y: 8,
      snappedX: true,
      snappedY: false,
    });
    expect(snapCenter({ x: 10, y: -2 }, T, { x: true, y: true })).toEqual({
      x: 10,
      y: 0,
      snappedX: false,
      snappedY: true,
    });
  });
});
