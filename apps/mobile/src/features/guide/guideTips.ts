// First-time guide tips (FR-ONB-10): one small tip on a real screen, the first time that screen opens. Tips
// are on for accounts that finish setup on this phone (the Promise turns them on) and for anyone who taps
// Show tips again; Turn off tips stops all of them. What has been shown is kept on the phone, per account.
import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';
import { create } from 'zustand';

import { GUIDE_TIPS, type GuideTipId } from './tipIds';

export type { GuideTipId };

const savedSchema = z.object({ on: z.boolean(), seen: z.array(z.enum(GUIDE_TIPS)) });
type Saved = z.infer<typeof savedSchema>;
const OFF: Saved = { on: false, seen: [] };

const key = (userId: string) => `guideTips:${userId}`;

async function read(userId: string): Promise<Saved> {
  const raw = await Storage.getItem(key(userId));
  if (!raw) return OFF;
  try {
    return savedSchema.parse(JSON.parse(raw));
  } catch {
    return OFF;
  }
}

type GuideState = {
  /** The account the state below belongs to; null until it is read from the phone. */
  userId: string | null;
  on: boolean;
  seen: readonly GuideTipId[];
};

export const useGuideStore = create<GuideState>()(() => ({ userId: null, on: false, seen: [] }));

/** The account's tips: the loaded state when it is this account's (it may be ahead of the phone), else the phone's. */
async function current(userId: string): Promise<Saved> {
  const state = useGuideStore.getState();
  return state.userId === userId ? { on: state.on, seen: [...state.seen] } : read(userId);
}

async function save(userId: string, next: Saved): Promise<void> {
  if (useGuideStore.getState().userId === userId) useGuideStore.setState(next);
  await Storage.setItem(key(userId), JSON.stringify(next));
}

/** Reads the account's tips from the phone, once per account. */
export async function loadGuideTips(userId: string): Promise<void> {
  if (useGuideStore.getState().userId === userId) return;
  const saved = await read(userId);
  useGuideStore.setState({ userId, ...saved });
}

/** The Promise (the end of setup) and Show tips again: every tip can show once more. */
export async function turnOnGuideTips(userId: string): Promise<void> {
  await save(userId, { on: true, seen: [] });
}

export async function turnOffGuideTips(userId: string): Promise<void> {
  await save(userId, { ...(await current(userId)), on: false });
}

/** Counts a tip as shown (it never shows again), or as no longer needed, such as Publish after publishing. */
export async function markGuideTipSeen(userId: string, id: GuideTipId): Promise<void> {
  const saved = await current(userId);
  if (!saved.seen.includes(id)) await save(userId, { ...saved, seen: [...saved.seen, id] });
}
