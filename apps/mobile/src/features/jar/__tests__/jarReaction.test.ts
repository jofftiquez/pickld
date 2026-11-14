import { jarMood, jarReaction } from '../jarReaction';

// D-131: which reaction a tap on the jar plays.
describe('jarMood', () => {
  it.each([
    [0, 'empty'],
    [1, 'few'],
    [3, 'few'],
    [4, 'half'],
    [5, 'half'],
    [6, 'nearlyFull'],
    [7, 'nearlyFull'],
    [8, 'full'],
    [12, 'full'],
    [-2, 'empty'],
  ] as const)('%i moments is %s', (count, mood) => {
    expect(jarMood(count, false)).toBe(mood);
  });

  it('a published jar is published whatever its count', () => {
    expect(jarMood(3, true)).toBe('published');
    expect(jarMood(8, true)).toBe('published');
  });
});

describe('jarReaction', () => {
  it('only a full jar sparkles and pops its lid; only a published jar shows a heart', () => {
    expect(jarReaction(8, false, 0)).toMatchObject({ overlay: 'sparkle', lidHop: true });
    expect(jarReaction(4, true, 0)).toMatchObject({ overlay: 'heart', lidHop: true });
    expect(jarReaction(7, false, 0)).toMatchObject({ overlay: null, lidHop: false });
    expect(jarReaction(0, false, 0)).toMatchObject({ overlay: null, lidHop: false });
  });

  it('repeat taps alternate the variant and change the strength', () => {
    const first = jarReaction(4, false, 0);
    const second = jarReaction(4, false, 1);
    expect([first.variant, second.variant]).toEqual([0, 1]);
    expect(second.strength).not.toBe(first.strength);
    for (let i = 0; i < 20; i += 1) {
      const { strength } = jarReaction(4, false, i);
      expect(strength).toBeGreaterThanOrEqual(0.85);
      expect(strength).toBeLessThanOrEqual(1.15);
    }
  });
});
