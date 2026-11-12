// Setup progress and resume (FR-ONB-09). After About you saves the profile, each setup screen records the next
// one on this phone; the app's index sends a signed-in person back to it, so quitting mid-setup resumes at the
// same step. Promise (the last step) clears it. Accounts with nothing recorded (finished, or set up before
// this existed) open on Today. Screens join SETUP_FLOW as they are built.
import type { Href } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';

export const SETUP_FLOW = ['/setup/day'] as const satisfies readonly Href[];
export type SetupRoute = (typeof SETUP_FLOW)[number];

const key = (userId: string) => `setupStep:${userId}`;
const isSetupRoute = (v: string | null): v is SetupRoute => (SETUP_FLOW as readonly string[]).includes(v ?? '');

export async function readSetupStep(userId: string): Promise<SetupRoute | null> {
  const value = await Storage.getItem(key(userId));
  return isSetupRoute(value) ? value : null;
}

/** Records where setup continues; null once setup is finished. */
export async function saveSetupStep(userId: string, route: SetupRoute | null): Promise<void> {
  if (route) await Storage.setItem(key(userId), route);
  else await Storage.removeItem(key(userId));
}

/** The step after `current`, or null after the last one built. About you leads to the first. */
export function nextSetupRoute(current: SetupRoute | '/setup/about'): SetupRoute | null {
  return SETUP_FLOW[(SETUP_FLOW as readonly string[]).indexOf(current) + 1] ?? null;
}
