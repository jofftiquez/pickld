import { filterIdSchema, filterMatrices, type ColorMatrix } from '../filters';

// Color filters (FR-CAP-04; AGENTS rule 8). Expectations are worked out by hand from how Skia applies a
// row-major 4×5 matrix to an unpremultiplied RGBA color in 0..1 (5th column = offset), not by reusing
// the module's own numbers.

type Rgba = [number, number, number, number];

function apply(m: ColorMatrix, [r, g, b, a]: Rgba): Rgba {
  const row = (i: number) => m[i * 5]! * r + m[i * 5 + 1]! * g + m[i * 5 + 2]! * b + m[i * 5 + 3]! * a + m[i * 5 + 4]!;
  return [row(0), row(1), row(2), row(3)];
}

function expectColor(actual: Rgba, expected: Rgba) {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 3));
}

const black: Rgba = [0, 0, 0, 1];
const white: Rgba = [1, 1, 1, 1];
const grey: Rgba = [0.5, 0.5, 0.5, 1];
const samples: Rgba[] = [black, white, grey, [0.8, 0.4, 0.2, 1], [0.1, 0.6, 0.9, 0.25], [1, 0, 0, 0.5]];
const ids = filterIdSchema.options;

describe('filter list', () => {
  it('is Original first, the first five in their old order, then the six added in QA item 23', () => {
    expect(ids).toEqual([
      'original',
      'kalamansi',
      'merienda',
      'mono',
      'dusk',
      'kape',
      'ube',
      'sampaguita',
      'gabi',
      'luma',
      'ulan',
    ]);
    expect(Object.keys(filterMatrices).sort()).toEqual([...ids].sort());
  });

  it('has no beauty or face-retouch filter (rule 8)', () => {
    for (const id of [...ids, ...Object.keys(filterMatrices)]) {
      expect(id).not.toMatch(/beauty|smooth|retouch|skin|face|slim|glow|whiten/i);
    }
    expect(filterIdSchema.safeParse('beauty').success).toBe(false);
    expect(filterIdSchema.safeParse('smooth').success).toBe(false);
  });

  it('gives every filter a 4×5 matrix of finite numbers', () => {
    for (const id of ids) {
      expect(filterMatrices[id]).toHaveLength(20);
      expect(filterMatrices[id].every(Number.isFinite)).toBe(true);
    }
  });
});

describe('every filter', () => {
  it.each(ids)('%s keeps alpha unchanged', (id) => {
    for (const color of samples) expect(apply(filterMatrices[id], color)[3]).toBeCloseTo(color[3], 6);
  });

  it.each(ids)('%s maps black and white inside 0..1, so neither clips', (id) => {
    for (const color of [black, white]) {
      for (const channel of apply(filterMatrices[id], color).slice(0, 3)) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each(ids.filter((id) => id !== 'original'))('%s visibly changes the photo', (id) => {
    const out = apply(filterMatrices[id], [0.8, 0.4, 0.2, 1]);
    const change = Math.abs(out[0] - 0.8) + Math.abs(out[1] - 0.4) + Math.abs(out[2] - 0.2);
    expect(change).toBeGreaterThan(0.05);
  });
});

describe('Original', () => {
  it('leaves every color unchanged', () => {
    for (const color of samples) expectColor(apply(filterMatrices.original, color), color);
  });
});

describe('Mono', () => {
  // Rec. 709 luminance, computed by hand: 0.2126 R + 0.7152 G + 0.0722 B.
  it.each<[string, Rgba, number]>([
    ['pure red', [1, 0, 0, 1], 0.2126],
    ['pure green', [0, 1, 0, 1], 0.7152],
    ['pure blue', [0, 0, 1, 1], 0.0722],
    ['orange', [0.8, 0.4, 0.2, 1], 0.17008 + 0.28608 + 0.01444],
    ['sky, half transparent', [0.1, 0.6, 0.9, 0.5], 0.02126 + 0.42912 + 0.06498],
  ])('turns %s into equal R, G and B at its luminance', (_name, color, luminance) => {
    expectColor(apply(filterMatrices.mono, color), [luminance, luminance, luminance, color[3]]);
  });

  it('keeps black black and white white', () => {
    expectColor(apply(filterMatrices.mono, black), black);
    expectColor(apply(filterMatrices.mono, white), white);
  });
});

describe('looks match their names', () => {
  it('Kalamansi: brighter, green-yellow (green ≥ red, blue lowest)', () => {
    const [r, g, b] = apply(filterMatrices.kalamansi, grey);
    expect(g).toBeGreaterThan(0.5);
    expect(r).toBeGreaterThan(0.5);
    expect(g).toBeGreaterThan(r);
    expect(b).toBeLessThan(r);
  });

  it('Merienda: warm golden (red > green > blue)', () => {
    const [r, g, b] = apply(filterMatrices.merienda, grey);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('Dusk: cool purple-blue (blue highest, red above green) with lifted shadows', () => {
    const [r, g, b] = apply(filterMatrices.dusk, grey);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
    for (const channel of apply(filterMatrices.dusk, black).slice(0, 3)) expect(channel).toBeGreaterThan(0.03);
  });

  it('Kape: warm faded brown (red > green > blue, lifted shadows, dimmed whites)', () => {
    const [r, g, b] = apply(filterMatrices.kape, grey);
    expect(r).toBeGreaterThan(g);
    expect(g - b).toBeGreaterThan(0.05);
    expect(apply(filterMatrices.kape, black)[0]).toBeGreaterThan(0.03);
    expect(apply(filterMatrices.kape, white)[2]).toBeLessThan(0.75);
  });

  it('Ube: soft lavender pastel (blue highest, red above green, lifted shadows)', () => {
    const [r, g, b] = apply(filterMatrices.ube, grey);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
    for (const channel of apply(filterMatrices.ube, black).slice(0, 3)) expect(channel).toBeGreaterThan(0.07);
  });

  it('Sampaguita: bright and clean, slightly cool (brighter grey, blue ≥ green ≥ red, all close)', () => {
    const [r, g, b] = apply(filterMatrices.sampaguita, grey);
    expect(Math.min(r, g, b)).toBeGreaterThan(0.5);
    expect(b).toBeGreaterThanOrEqual(g);
    expect(g).toBeGreaterThanOrEqual(r);
    expect(b - r).toBeLessThan(0.05);
  });

  it('Gabi: cool night with deep blacks (blue highest, red lowest, darker grey)', () => {
    const [r, g, b] = apply(filterMatrices.gabi, grey);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeLessThan(0.45);
    for (const channel of apply(filterMatrices.gabi, black).slice(0, 3)) expect(channel).toBeLessThanOrEqual(0.02);
  });

  it('Luma: faded sepia (low saturation, warm, the most lifted blacks)', () => {
    const orange = apply(filterMatrices.luma, [0.8, 0.4, 0.2, 1]);
    expect(orange[0] - orange[2]).toBeLessThan(0.4); // the original spread is 0.6
    const [r, g, b] = apply(filterMatrices.luma, grey);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(apply(filterMatrices.luma, black)[0]).toBeGreaterThanOrEqual(0.1);
  });

  it('Ulan: muted blue-green (green and blue above red, low saturation)', () => {
    const [r, g, b] = apply(filterMatrices.ulan, grey);
    expect(g).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(r);
    const orange = apply(filterMatrices.ulan, [0.8, 0.4, 0.2, 1]);
    expect(orange[0] - orange[2]).toBeLessThan(0.3);
  });
});

describe('the looks are distinct', () => {
  it('no two filters turn a test color into nearly the same color', () => {
    const probes: Rgba[] = [grey, [0.8, 0.4, 0.2, 1], [0.2, 0.5, 0.8, 1], [0.3, 0.7, 0.3, 1]];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        let distance = 0;
        for (const probe of probes) {
          const a = apply(filterMatrices[ids[i]!], probe);
          const b = apply(filterMatrices[ids[j]!], probe);
          distance += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        }
        expect({ pair: `${ids[i]}/${ids[j]}`, far: distance > 0.15 }).toEqual({
          pair: `${ids[i]}/${ids[j]}`,
          far: true,
        });
      }
    }
  });
});
