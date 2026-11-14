import { MAX_LAYERS } from '@/components/JarGraphic';

// The jar easter egg (D-131): tapping the jar on Today or a day page plays a short reaction that depends on
// how full it is. Pure, so the choice is tested apart from the animation.

/** How full the jar is, in the order the reactions grow. */
export type JarMood = 'empty' | 'few' | 'half' | 'nearlyFull' | 'full' | 'published';

/** What a tap plays. `variant` alternates on repeat taps; `strength` (0.85–1.15) nudges the size so no two
 * taps in a row look identical. `overlay` floats over the jar; `lidHop` lifts the lid and lets it drop. */
export type JarReaction = {
  mood: JarMood;
  variant: 0 | 1;
  strength: number;
  overlay: 'sparkle' | 'heart' | null;
  lidHop: boolean;
};

export function jarMood(count: number, published: boolean): JarMood {
  if (published) return 'published';
  const layers = Math.max(0, Math.min(MAX_LAYERS, Math.round(count)));
  if (layers === 0) return 'empty';
  if (layers <= 3) return 'few';
  if (layers <= 5) return 'half';
  if (layers < MAX_LAYERS) return 'nearlyFull';
  return 'full';
}

// Steps through 0.85…1.15 in a fixed, non-repeating-looking order, so tests stay deterministic.
const STRENGTHS = [1, 0.9, 1.12, 0.95, 1.05, 0.85, 1.15];

/** The reaction for the `tapIndex`-th tap (0-based) on a jar holding `count` moments. */
export function jarReaction(count: number, published: boolean, tapIndex: number): JarReaction {
  const mood = jarMood(count, published);
  const index = Math.max(0, Math.floor(tapIndex));
  const variant = (index % 2) as 0 | 1;
  const strength = STRENGTHS[index % STRENGTHS.length] ?? 1;
  const overlay = mood === 'published' ? 'heart' : mood === 'full' ? 'sparkle' : null;
  const lidHop = mood === 'full' || mood === 'published';
  return { mood, variant, strength, overlay, lidHop };
}
