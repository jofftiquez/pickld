// First moment tip (FR-ONB-08): shown once, over Today on the account's first day while the jar is still
// empty. It counts as shown the moment it opens, so quitting with it up doesn't bring it back, and it closes for
// good once it no longer applies (Today left for another screen, or a first moment captured). It waits for a
// toast on screen to leave first (such as "You and @mia read each other" after a friend's code): the sheet would
// cover it.
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import { useToastStore } from '@/lib/toast';

const key = (userId: string) => `firstMomentTip:${userId}`;

/** `eligible`: Today in front, first day (no jar yet) and nothing captured. */
export function useFirstMomentTip(userId: string | null, eligible: boolean) {
  const [visible, setVisible] = useState(false);
  const toastUp = useToastStore((s) => s.current !== null);

  // No longer applies while up: close it now, during render (it already counted as shown).
  if (visible && !eligible) setVisible(false);

  useEffect(() => {
    if (!userId || !eligible || toastUp) return;
    let alive = true;
    void Storage.getItem(key(userId)).then(async (seen) => {
      if (!alive || seen) return;
      await Storage.setItem(key(userId), new Date().toISOString());
      if (alive) setVisible(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, eligible, toastUp]);

  return { visible, close: () => setVisible(false) };
}
