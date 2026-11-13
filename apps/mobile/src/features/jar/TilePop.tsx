import type { ReactNode } from 'react';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { usePop } from '@/lib/usePop';

// A filled tile springs in from this share of its size (D-77).
const TILE_POP_FROM = 0.85;

export type TilePopProps = {
  /** The slot just filled: the tile pops in, or fades in with Reduce Motion. */
  play: boolean;
  slot: string;
  children: ReactNode;
};

/** Wraps a Today or day page tile so a newly filled slot pops in (D-58; Main). */
export function TilePop({ play, slot, children }: TilePopProps) {
  const reduceMotion = useReducedMotion();
  const style = usePop(play, TILE_POP_FROM);
  return (
    <Animated.View style={style} testID={play ? `tile-${slot}-${reduceMotion ? 'fade' : 'pop'}` : `tile-${slot}-still`}>
      {children}
    </Animated.View>
  );
}
