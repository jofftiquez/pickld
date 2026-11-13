// The publish moment (D-58, D-77): /publish remembers the jar it just published, and the page it returns to
// (Today, or the day page for a past day) plays a short confetti burst and closes the jar card's lid once,
// when it is in front again and shows that jar. Plain visits play nothing.
import { useEffect } from 'react';
import { create } from 'zustand';

import { useScreenFocused } from '@/lib/useScreenFocused';
import { motion } from '@/theme/tokens';

/** `pending`: published, waiting for its page to be in front. `playing`: celebrating on its page now. */
const usePublishMoment = create<{ pending: string | null; playing: string | null }>()(() => ({
  pending: null,
  playing: null,
}));

/** Called once the jar is published: the page showing it celebrates when it is back in front. */
export function markJarPublished(jarId: string): void {
  usePublishMoment.setState({ pending: jarId });
}

// Long enough for the last confetti piece to land and rest a moment; then the burst fades out.
const CONFETTI_PIECES = 8;
const CONFETTI_STAGGER = 60;
export const PUBLISH_CELEBRATION_MS = motion.confettiFall + CONFETTI_PIECES * CONFETTI_STAGGER + motion.base * 2;

/** True while the page showing `jarId` celebrates its publishing; once per publish. */
export function usePublishCelebration(jarId: string | null): boolean {
  const focused = useScreenFocused();
  const pending = usePublishMoment((s) => s.pending);
  const playing = usePublishMoment((s) => s.playing);
  useEffect(() => {
    if (!focused || jarId === null || pending !== jarId) return;
    // Taken at once, so a re-render or another page never plays it again. The timer belongs to the store, not
    // the page, so leaving the page early still ends it and the next visit plays nothing.
    usePublishMoment.setState({ pending: null, playing: jarId });
    setTimeout(
      () => usePublishMoment.setState((s) => (s.playing === jarId ? { playing: null } : s)),
      PUBLISH_CELEBRATION_MS,
    );
  }, [focused, jarId, pending]);
  const celebrating = jarId !== null && playing === jarId;
  return celebrating;
}
