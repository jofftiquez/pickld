// Crop's last Fit frame style (D-152): kept on this phone only, in the local key-value store, so the next
// photo fitted starts on the frame chosen last time. Fill stays the default for every photo; only the frame is
// remembered.
import Storage from 'expo-sqlite/kv-store';

import { fitFrames, type FitFrame } from '@/lib/image/crop';

const FRAME_KEY = 'crop:fitFrame';

export const DEFAULT_FIT_FRAME: FitFrame = 'white';

/** The frame style chosen last time; white when none was, or the stored value can't be read. */
export async function getFitFrame(): Promise<FitFrame> {
  try {
    const value = await Storage.getItem(FRAME_KEY);
    return fitFrames.find((frame) => frame === value) ?? DEFAULT_FIT_FRAME;
  } catch {
    return DEFAULT_FIT_FRAME;
  }
}

/** Remembers `frame`; a store that fails only forgets it. */
export async function setFitFrame(frame: FitFrame): Promise<void> {
  try {
    await Storage.setItem(FRAME_KEY, frame);
  } catch {
    // The choice still applies to this photo.
  }
}
