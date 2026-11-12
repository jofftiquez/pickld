// First moment tip (FR-ONB-08): shown once, over Today on the account's first day while the jar is still
// empty. It counts as shown the moment it opens, so quitting with it up doesn't bring it back.
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

const key = (userId: string) => `firstMomentTip:${userId}`;

/** `eligible`: first day (no jar yet) and nothing captured. */
export function useFirstMomentTip(userId: string | null, eligible: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId || !eligible) return;
    let alive = true;
    void Storage.getItem(key(userId)).then(async (seen) => {
      if (!alive || seen) return;
      await Storage.setItem(key(userId), new Date().toISOString());
      if (alive) setVisible(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, eligible]);

  return { visible, close: () => setVisible(false) };
}
