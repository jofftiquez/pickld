// Hide like counts (calm controls): the number of likes leaves people's posts, yours included, wherever this
// person looks: the Moments and Jars tabs, the Jar page, Moment detail and preview, and Today. Liking still works
// and the heart still fills. Like guide tips, it's kept on this phone, per account; nothing is sent anywhere.
import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import { create } from 'zustand';

import { useAuthStore } from '@/lib/authStore';

const key = (userId: string) => `hideLikeCounts:${userId}`;

type LikeCountsState = {
  /** The account `hide` belongs to; null until it is read from the phone. */
  userId: string | null;
  hide: boolean;
};

export const useLikeCountsStore = create<LikeCountsState>()(() => ({ userId: null, hide: false }));

async function load(userId: string): Promise<void> {
  if (useLikeCountsStore.getState().userId === userId) return;
  const hide = (await Storage.getItem(key(userId))) === 'on';
  useLikeCountsStore.setState({ userId, hide });
}

export async function setHideLikeCounts(userId: string, hide: boolean): Promise<void> {
  useLikeCountsStore.setState({ userId, hide });
  await Storage.setItem(key(userId), hide ? 'on' : 'off');
}

/** Whether the signed-in person hides like counts; false until read from the phone (counts show by default). */
export function useHideLikeCounts(): boolean {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const loadedFor = useLikeCountsStore((s) => s.userId);
  const hide = useLikeCountsStore((s) => s.hide);
  useEffect(() => {
    // A store that can't be read keeps counts showing.
    if (userId !== null && loadedFor !== userId) load(userId).catch(() => {});
  }, [userId, loadedFor]);
  return userId !== null && loadedFor === userId && hide;
}
